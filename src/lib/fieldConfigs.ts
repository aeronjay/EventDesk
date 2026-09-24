import { supabase } from './supabaseClient'

export interface FieldConfig {
  id: string
  field_name: string
  label: string
  field_type: 'text' | 'select' | 'number' | 'date' | 'time' | 'textarea'
  options: string[]
  is_required: boolean
  validation_rule: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export async function fetchFieldConfigs(): Promise<FieldConfig[]> {
  const { data, error } = await supabase
    .from('field_configs')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw error
  return data as FieldConfig[]
}

export async function updateFieldConfig(
  id: string,
  updates: Partial<Pick<FieldConfig, 'field_type' | 'options' | 'is_required' | 'validation_rule' | 'label'>>
) {
  const { data, error } = await supabase
    .from('field_configs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as FieldConfig
}
