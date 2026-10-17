import { supabase, isDemoMode } from './supabaseClient'
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
  // Demo mode: pretend it worked, nothing is sent to Telegram
  if (isDemoMode) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { success: true }
  }

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
