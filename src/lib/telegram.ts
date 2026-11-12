import { supabase } from './supabaseClient'
import type { Solicitation } from './solicitations'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// ── App Settings (key-value store for app-wide config) ──

export async function getAppSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.error(`Failed to fetch app setting "${key}":`, error)
    return null
  }
  return data?.value ?? null
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) throw error
}

// ── Telegram ──

export async function sendToTelegram(solicitation: Solicitation): Promise<{ success: boolean; error?: string }> {
  // Fetch the chat ID from app settings
  const chatId = await getAppSetting('telegram_chat_id')

  if (!chatId) {
    return {
      success: false,
      error: 'Telegram Chat ID is not configured. Go to Settings → Telegram Integration to set it up.',
    }
  }

  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      solicitation,
      chat_id: chatId,
    }),
  })

  const result = await response.json()

  if (!response.ok || result.error) {
    return { success: false, error: result.error || 'Failed to send to Telegram' }
  }

  return { success: true }
}

// Deletes the messages of one send from the Telegram chat and marks the log
// row as deleted. Telegram only lets bots delete messages under 48 hours old.
export async function deleteTelegramSend(sendId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ send_id: sendId }),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || result.error) {
    return { success: false, error: result.error || 'Failed to delete from Telegram' }
  }

  return { success: true }
}

// ── Telegram send log ──

export interface TelegramSend {
  id: string
  solicitation_id: string | null
  sent_by: string | null
  sent_by_email: string | null
  chat_id: string
  status: 'success' | 'failed'
  error: string | null
  message_id: number | null
  message_ids: number[] | null
  control_number: string | null
  organization_name: string | null
  event: string | null
  event_date: string | null
  sent_at: string
  deleted_at: string | null
  deleted_by: string | null
  deleted_by_email: string | null
}

// Telegram stops letting bots delete messages 48 hours after they were sent
export const TELEGRAM_DELETE_WINDOW_MS = 48 * 60 * 60 * 1000

// A successful send whose messages are still in the Telegram chat
export function isActiveSend(send: TelegramSend): boolean {
  return send.status === 'success' && !send.deleted_at
}

// All send attempts for one solicitation, newest first
export async function fetchTelegramSendsFor(solicitationId: string): Promise<TelegramSend[]> {
  const { data, error } = await supabase
    .from('telegram_sends')
    .select('*')
    .eq('solicitation_id', solicitationId)
    .order('sent_at', { ascending: false })

  if (error) throw error
  return data as TelegramSend[]
}

export interface FetchTelegramSendsOptions {
  page: number
  pageSize: number
  search?: string
  status?: 'all' | 'success' | 'failed' | 'deleted'
}

// A log row plus the creator of its solicitation (null if it was deleted),
// used to decide who may delete the send
export interface TelegramLogEntry extends TelegramSend {
  solicitation_created_by: string | null
}

export async function fetchPaginatedTelegramSends(
  opts: FetchTelegramSendsOptions
): Promise<{ data: TelegramLogEntry[]; totalCount: number }> {
  const { page, pageSize, search, status } = opts
  const from = (page - 1) * pageSize

  let q = supabase
    .from('telegram_sends')
    .select('*, solicitations(created_by)', { count: 'exact' })

  if (status === 'success') {
    q = q.eq('status', 'success').is('deleted_at', null)
  } else if (status === 'deleted') {
    q = q.not('deleted_at', 'is', null)
  } else if (status === 'failed') {
    q = q.eq('status', 'failed')
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`
    q = q.or(
      `organization_name.ilike.${term},control_number.ilike.${term},event.ilike.${term},sent_by_email.ilike.${term}`
    )
  }

  const { data, error, count } = await q
    .order('sent_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error
  const rows = (data ?? []).map(({ solicitations, ...send }) => ({
    ...(send as TelegramSend),
    solicitation_created_by:
      (solicitations as { created_by: string | null } | null)?.created_by ?? null,
  }))
  return { data: rows, totalCount: count ?? 0 }
}
