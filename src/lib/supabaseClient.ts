import { createClient } from '@supabase/supabase-js'
import { mockSupabase } from './demo/mockSupabase'

// `npm run dev:demo` / `npm run build:demo` run Vite in "demo" mode: no network, fictional data.
export const isDemoMode = import.meta.env.MODE === 'demo'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = isDemoMode
  ? (mockSupabase as unknown as ReturnType<typeof createClient>)
  : createClient(supabaseUrl, supabaseAnonKey)
