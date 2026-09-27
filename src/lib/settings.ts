import { supabase } from './supabaseClient'

export interface UserSettings {
  user_id: string
  receive_notifications: boolean
  updated_at: string
}

export async function fetchUserSettings(userId: string) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  
  return data as UserSettings | null
}

export async function updateUserSettings(userId: string, receive_notifications: boolean) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ 
      user_id: userId, 
      receive_notifications,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data as UserSettings
}
