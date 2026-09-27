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
    .neq('field_name', 'enable_excel_download')
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

export async function getExcelDownloadSetting(): Promise<boolean> {
  const { data, error } = await supabase
    .from('field_configs')
    .select('is_required')
    .eq('field_name', 'enable_excel_download')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    const { error: insertError } = await supabase.from('field_configs').insert({
      field_name: 'enable_excel_download',
      label: 'Enable Excel Download',
      field_type: 'text',
      options: [],
      is_required: true,
      display_order: 999,
      validation_rule: null,
      default_value: null,
      color_mappings: null
    })
    if (insertError) console.error('Failed to create excel setting', insertError)
    return true
  }
  return data.is_required
}

export async function toggleExcelDownloadSetting(enabled: boolean) {
  const { error } = await supabase
    .from('field_configs')
    .update({ is_required: enabled, updated_at: new Date().toISOString() })
    .eq('field_name', 'enable_excel_download')
  if (error) throw error
}
