import { useState, useEffect } from 'react'
import {
  createSolicitation,
  updateSolicitation,
  type Solicitation,
} from '@/lib/solicitations'
import type { FieldConfig } from '@/lib/fieldConfigs'
import { useAuth } from '@/contexts/AuthContext'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Save, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface SolicitationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitation: Solicitation | null // null = Add mode
  fieldConfigs: FieldConfig[]
  onSaved: () => void
}

export function SolicitationSheet({
  open,
  onOpenChange,
  solicitation,
  fieldConfigs,
  onSaved,
}: SolicitationSheetProps) {
  const { user } = useAuth()
  const isEdit = !!solicitation
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Initialize form data when sheet opens
  useEffect(() => {
    if (open) {
      if (solicitation) {
        // Populate from existing solicitation
        const data: Record<string, string> = {}
        const solicitRecord = solicitation as unknown as Record<string, unknown>
        fieldConfigs.forEach((config) => {
          const value = solicitRecord[config.field_name]
          data[config.field_name] = value != null ? String(value) : ''
        })
        if (solicitation.control_number_color) {
          data.control_number_color = solicitation.control_number_color
        }
        setFormData(data)
      } else {
        // Blank form
        const data: Record<string, string> = {}
        fieldConfigs.forEach((config) => {
          data[config.field_name] = config.default_value ?? ''
        })
        setFormData(data)
      }
      setErrors({})
    }
  }, [open, solicitation, fieldConfigs])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    fieldConfigs.forEach((config) => {
      const value = formData[config.field_name]?.trim() ?? ''

      // Required check
      if (config.is_required && !value) {
        newErrors[config.field_name] = `${config.label} is required`
        return
      }

      // Regex validation
      if (value && config.validation_rule) {
        try {
          const regex = new RegExp(config.validation_rule)
          if (!regex.test(value)) {
            newErrors[config.field_name] = `${config.label} format is invalid`
          }
        } catch {
          // Invalid regex — skip
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setSaving(true)
    try {
      // Build the record — convert empty strings to null
      const record: Record<string, string | null> = {}
      fieldConfigs.forEach((config) => {
        const val = formData[config.field_name]?.trim()
        record[config.field_name] = val || null
      })
      if (formData.control_number_color) {
        record.control_number_color = formData.control_number_color
      } else {
        record.control_number_color = null
      }

      if (isEdit && solicitation) {
        await updateSolicitation(solicitation.id, record)
        toast.success('Solicitation updated successfully')
      } else {
        await createSolicitation({ ...record, created_by: user?.id ?? null })
        toast.success('Solicitation created successfully')
      }
      onSaved()
    } catch (err) {
      console.error(err)
      toast.error(isEdit ? 'Failed to update' : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (fieldName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
    // Clear error on edit
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[fieldName]
        return next
      })
    }
  }

  const renderField = (config: FieldConfig) => {
    const value = formData[config.field_name] ?? ''
    const error = errors[config.field_name]
    const fieldId = `field-${config.field_name}`

    return (
      <div key={config.field_name} className="space-y-1.5">
        <Label htmlFor={fieldId} className="text-sm">
          {config.label}
          {config.is_required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>

        {config.field_type === 'select' && config.options.length > 0 ? (
          <Select
            value={value}
            onValueChange={(v) => updateField(config.field_name, v ?? '')}
          >
            <SelectTrigger id={fieldId} className={error ? 'border-destructive' : ''}>
              <SelectValue placeholder={`Select ${config.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {config.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : config.field_type === 'textarea' ? (
          <Textarea
            id={fieldId}
            value={value}
            onChange={(e) => updateField(config.field_name, e.target.value)}
            placeholder={`Enter ${config.label.toLowerCase()}`}
            rows={3}
            className={error ? 'border-destructive' : ''}
          />
        ) : config.field_type === 'date' ? (
          <Input
            id={fieldId}
            type="date"
            value={value}
            onChange={(e) => updateField(config.field_name, e.target.value)}
            className={error ? 'border-destructive' : ''}
          />
        ) : config.field_type === 'time' ? (
          <Input
            id={fieldId}
            type="time"
            value={value}
            onChange={(e) => updateField(config.field_name, e.target.value)}
            className={error ? 'border-destructive' : ''}
          />
        ) : config.field_type === 'number' ? (
          <Input
            id={fieldId}
            type="number"
            value={value}
            onChange={(e) => updateField(config.field_name, e.target.value)}
            placeholder={`Enter ${config.label.toLowerCase()}`}
            className={error ? 'border-destructive' : ''}
          />
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id={fieldId}
              type="text"
              value={value}
              onChange={(e) => updateField(config.field_name, e.target.value)}
              placeholder={`Enter ${config.label.toLowerCase()}`}
              className={`flex-1 ${error ? 'border-destructive' : ''}`}
            />
            {config.field_name === 'control_number' && config.color_mappings && config.color_mappings.length > 0 && (
              <Select
                value={formData.control_number_color || 'none'}
                onValueChange={(v) => updateField('control_number_color', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Group/Color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Color</SelectItem>
                  {config.color_mappings.map((cm, idx) => (
                    <SelectItem key={idx} value={cm.color}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: cm.color }}
                        />
                        {cm.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle size={12} />
            {error}
          </p>
        )}

        {config.validation_rule && !error && (
          <p className="text-xs text-muted-foreground">
            Pattern: {config.validation_rule}
          </p>
        )}
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>{isEdit ? 'Edit Solicitation' : 'Add Solicitation'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `Editing record for ${solicitation?.organization_name || solicitation?.control_number || 'this solicitation'}`
              : 'Fill out the details to create a new solicitation record'}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <form id="solicitation-form" onSubmit={handleSubmit} className="space-y-4 py-4">
            {fieldConfigs.map(renderField)}
          </form>
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="solicitation-form"
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={16} />
                {isEdit ? 'Update' : 'Create'}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
