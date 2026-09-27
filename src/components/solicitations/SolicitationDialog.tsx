import { useState, useEffect } from 'react'
import {
  createSolicitation,
  updateSolicitation,
  type Solicitation,
} from '@/lib/solicitations'
import { FileUpload, type Attachment } from './FileUpload'
import type { FieldConfig } from '@/lib/fieldConfigs'
import { useAuth } from '@/contexts/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from '@/components/ui/separator'
import { Save, Loader2, AlertCircle, CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface SolicitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitation: Solicitation | null // null = Add mode
  fieldConfigs: FieldConfig[]
  onSaved: (record: Solicitation, isEdit: boolean) => void
}

export function SolicitationDialog({
  open,
  onOpenChange,
  solicitation,
  fieldConfigs,
  onSaved,
}: SolicitationDialogProps) {
  const { user } = useAuth()
  const isEdit = !!solicitation
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [prevSolId, setPrevSolId] = useState<string | null | undefined>(undefined)

  // Initialize form data when dialog opens, but only if the solicitation being viewed has changed
  useEffect(() => {
    if (open) {
      const currentId = solicitation?.id ?? null
      
      if (currentId !== prevSolId) {
        setPrevSolId(currentId)
        
        if (solicitation) {
          // Populate from existing solicitation
          const data: Record<string, string> = {}
          const solicitRecord = solicitation as unknown as Record<string, unknown>
          fieldConfigs.forEach((config) => {
            let value = solicitRecord[config.field_name]
            if (config.field_type === 'time' && typeof value === 'string') {
               const match = value.match(/^(\d{2}:\d{2}(:\d{2})?)/)
               if (match) {
                   value = match[1]
               }
            }
            data[config.field_name] = value != null ? String(value) : ''
          })
          if (solicitation.control_number_color) {
            data.control_number_color = solicitation.control_number_color
          }
          setFormData(data)
          
          let atts = solicitation.attachments || []
          if (typeof atts === 'string') {
            try { atts = JSON.parse(atts) } catch (e) { atts = [] }
          }
          setAttachments(atts as Attachment[])
        } else {
          // Blank form
          const data: Record<string, string> = {}
          fieldConfigs.forEach((config) => {
            data[config.field_name] = config.default_value ?? ''
          })
          setFormData(data)
          setAttachments([])
        }
        setErrors({})
      }
    }
  }, [open, solicitation, fieldConfigs, prevSolId])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    let firstErrorFieldId = ''

    fieldConfigs.forEach((config) => {
      const value = formData[config.field_name]?.trim() ?? ''

      // Required check
      if (config.is_required && !value) {
        newErrors[config.field_name] = `${config.label} is required`
        if (!firstErrorFieldId) firstErrorFieldId = `field-${config.field_name}`
        return
      }

      // Regex validation
      if (value && config.validation_rule) {
        try {
          const regex = new RegExp(config.validation_rule)
          if (!regex.test(value)) {
            newErrors[config.field_name] = `${config.label} format is invalid`
            if (!firstErrorFieldId) firstErrorFieldId = `field-${config.field_name}`
          }
        } catch {
          // Invalid regex — skip
        }
      }
    })

    setErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) {
      toast.error('Please check the form for errors')
      
      // Scroll to the first error
      if (firstErrorFieldId) {
        setTimeout(() => {
          const el = document.getElementById(firstErrorFieldId)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.focus()
          }
        }, 100)
      }
      return false
    }
    
    return true
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
      
      (record as any).attachments = attachments

      let savedRecord: Solicitation
      if (isEdit && solicitation) {
        savedRecord = await updateSolicitation(solicitation.id, record)
        toast.success('Solicitation updated successfully')
      } else {
        savedRecord = await createSolicitation({ ...record, created_by: user?.id ?? null })
        toast.success('Solicitation created successfully')
      }
      onSaved(savedRecord, isEdit)
      
      // If it was an "Add" operation, force the form to reset so next time it's empty
      if (!isEdit) {
        setPrevSolId(undefined)
      }
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
    const isTextarea = config.field_type === 'textarea' || config.field_name === 'remarks' || config.field_name === 'additional_note' || config.field_name === 'request';

    return (
      <div key={config.field_name} className={`space-y-1.5 ${isTextarea ? 'md:col-span-4' : ''}`}>
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
        ) : isTextarea ? (
          <Textarea
            id={fieldId}
            value={value}
            onChange={(e) => updateField(config.field_name, e.target.value)}
            placeholder={`Enter ${config.label.toLowerCase()}`}
            rows={2}
            className={error ? 'border-destructive' : ''}
          />
        ) : config.field_type === 'date' ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  id={fieldId}
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal flex",
                    !value && "text-muted-foreground",
                    error && "border-destructive"
                  )}
                />
              }
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(new Date(`${value}T00:00:00`), "PPP") : <span>Pick a date</span>}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(`${value}T00:00:00`) : undefined}
                onSelect={(date) => updateField(config.field_name, date ? format(date, "yyyy-MM-dd") : '')}
              />
            </PopoverContent>
          </Popover>
        ) : config.field_type === 'time' ? (
          <Input
            id={fieldId}
            type="time"
            value={value}
            onClick={() => {
              if (!value) updateField(config.field_name, '08:00')
            }}
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
                onValueChange={(v) => updateField('control_number_color', v === 'none' ? '' : (v ?? ''))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Group/Color">
                    {formData.control_number_color && formData.control_number_color !== 'none' ? (
                      (() => {
                        const cm = config.color_mappings?.find(c => c.color === formData.control_number_color)
                        if (cm) {
                          return (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full border border-border"
                                style={{ backgroundColor: cm.color }}
                              />
                              <span className="truncate">{cm.label}</span>
                            </div>
                          )
                        }
                        // Fallback if mapping was removed
                        return (
                           <div className="flex items-center gap-2">
                             <div
                               className="w-3 h-3 rounded-full border border-border"
                               style={{ backgroundColor: formData.control_number_color }}
                             />
                             <span className="truncate">{formData.control_number_color}</span>
                           </div>
                        )
                      })()
                    ) : (
                      'No Color'
                    )}
                  </SelectValue>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] md:max-w-6xl lg:max-w-7xl flex flex-col p-0 max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{isEdit ? 'Edit Solicitation' : 'Add Solicitation'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Editing record for ${solicitation?.organization_name || solicitation?.control_number || 'this solicitation'}`
              : 'Fill out the details to create a new solicitation record'}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <form id="solicitation-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 py-4">
            {fieldConfigs.map(renderField)}
            <div className="md:col-span-4 mt-2">
              <Label className="text-sm block mb-2">Attachments</Label>
              <FileUpload attachments={attachments} onChange={setAttachments} />
            </div>
          </form>
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-muted/20">
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
      </DialogContent>
    </Dialog>
  )
}
