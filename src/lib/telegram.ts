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
  control_number: string | null
  organization_name: string | null
  event: string | null
  event_date: string | null
  sent_at: string
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
  status?: 'all' | 'success' | 'failed'
}

export async function fetchPaginatedTelegramSends(
  opts: FetchTelegramSendsOptions
): Promise<{ data: TelegramSend[]; totalCount: number }> {
  const { page, pageSize, search, status } = opts
  const from = (page - 1) * pageSize

  let q = supabase
    .from('telegram_sends')
    .select('*', { count: 'exact' })

  if (status && status !== 'all') {
    q = q.eq('status', status)
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
  return { data: (data ?? []) as TelegramSend[], totalCount: count ?? 0 }
}
