import { supabase } from './supabaseClient'

export interface ColorMapping {
  color: string
  label: string
}

export interface FieldConfig {
  id: string
  field_name: string
  label: string
  field_type: 'text' | 'select' | 'number' | 'date' | 'time' | 'textarea'
  options: string[]
  is_required: boolean
  validation_rule: string | null
  default_value: string | null
  color_mappings: ColorMapping[] | null
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
  updates: Partial<Pick<FieldConfig, 'field_type' | 'options' | 'is_required' | 'validation_rule' | 'label' | 'default_value' | 'color_mappings'>>
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
