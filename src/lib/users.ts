import { supabase } from './supabaseClient'

// Email for each user id, via the get_user_emails RPC
// (supabase/sql/get_user_emails.sql). Unknown ids are left out.
export async function fetchUserEmails(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return {}

  const { data, error } = await supabase.rpc('get_user_emails', { user_ids: ids })
  if (error) throw error

  const emails: Record<string, string> = {}
  for (const row of (data ?? []) as { id: string; email: string | null }[]) {
    if (row.email) emails[row.id] = row.email
  }
  return emails
}
