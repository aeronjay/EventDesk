import { supabase } from './supabaseClient'

export interface Solicitation {
  id: string
  type: string | null
  control_number: string | null
  date_received: string | null
  organization_name: string | null
  sub_area: string | null
  event: string | null
  event_date: string | null
  event_time: string | null
  request: string | null
  venue: string | null
  contact_person: string | null
  contact_number: string | null
  status: string | null
  recom: string | null
  remarks: string | null
  voters_turnout: string | null
  additional_note: string | null
  control_number_color: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SolicitationInsert = Omit<Solicitation, 'id' | 'created_at' | 'updated_at'>

export async function fetchSolicitations() {
  const { data, error } = await supabase
    .from('solicitations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Solicitation[]
}

export async function fetchSolicitation(id: string) {
  const { data, error } = await supabase
    .from('solicitations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Solicitation
}

export async function createSolicitation(record: Partial<SolicitationInsert>) {
  const { data, error } = await supabase
    .from('solicitations')
    .insert(record)
    .select()
    .single()

  if (error) throw error
  return data as Solicitation
}

export async function updateSolicitation(id: string, updates: Partial<SolicitationInsert>) {
  const { data, error } = await supabase
    .from('solicitations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Solicitation
}

export async function deleteSolicitation(id: string) {
  const { error } = await supabase
    .from('solicitations')
    .delete()
    .eq('id', id)

  if (error) throw error
}
