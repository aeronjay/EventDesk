import { useState, useEffect } from 'react'
import type { FieldConfig } from '@/lib/fieldConfigs'
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
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save, Loader2, Plus, X } from 'lucide-react'

interface FieldConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fieldConfig: FieldConfig | null
  onSave: (id: string, updates: Partial<FieldConfig>) => Promise<void>
}

const fieldTypes = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown (Select)' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'textarea', label: 'Long Text (Textarea)' },
]

export function FieldConfigSheet({
  open,
  onOpenChange,
  fieldConfig,
  onSave,
}: FieldConfigSheetProps) {
  const [fieldType, setFieldType] = useState('text')
  const [isRequired, setIsRequired] = useState(false)
  const [validationRule, setValidationRule] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [newOption, setNewOption] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && fieldConfig) {
      setFieldType(fieldConfig.field_type)
      setIsRequired(fieldConfig.is_required)
      setValidationRule(fieldConfig.validation_rule ?? '')
      setOptions(fieldConfig.options ?? [])
      setNewOption('')
    }
  }, [open, fieldConfig])

  const handleAddOption = () => {
    const value = newOption.trim()
    if (!value) return
    if (options.includes(value)) return
    setOptions((prev) => [...prev, value])
    setNewOption('')
  }

  const handleRemoveOption = (opt: string) => {
    setOptions((prev) => prev.filter((o) => o !== opt))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddOption()
    }
  }

  const handleSave = async () => {
    if (!fieldConfig) return
    setSaving(true)
    try {
      await onSave(fieldConfig.id, {
        field_type: fieldType as FieldConfig['field_type'],
        is_required: isRequired,
        validation_rule: validationRule.trim() || null,
        options: fieldType === 'select' ? options : [],
      })
    } finally {
      setSaving(false)
    }
  }

  if (!fieldConfig) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>Edit Field: {fieldConfig.label}</SheetTitle>
          <SheetDescription>
            Configure how the <strong>{fieldConfig.label}</strong> field behaves in solicitation forms.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-6 py-4">
            {/* Field Name (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Field Name</Label>
              <p className="text-sm font-mono bg-muted px-3 py-2 rounded-lg">
                {fieldConfig.field_name}
              </p>
            </div>

            {/* Field Type */}
            <div className="space-y-1.5">
              <Label htmlFor="config-field-type">Field Type</Label>
              <Select value={fieldType} onValueChange={(v) => { if (v) setFieldType(v) }}>
                <SelectTrigger id="config-field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldTypes.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines the input type shown on the solicitation form
              </p>
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="config-required" className="text-sm">Required</Label>
                <p className="text-xs text-muted-foreground">
                  Users must fill this field to save
                </p>
              </div>
              <Switch
                id="config-required"
                checked={isRequired}
                onCheckedChange={setIsRequired}
              />
            </div>

            {/* Validation Rule */}
            {fieldType !== 'select' && (
              <div className="space-y-1.5">
                <Label htmlFor="config-validation">Validation Pattern (Regex)</Label>
                <Input
                  id="config-validation"
                  value={validationRule}
                  onChange={(e) => setValidationRule(e.target.value)}
                  placeholder="e.g. ^[0-9]+$ for numbers only"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Optional regular expression to validate user input
                </p>
              </div>
            )}

            {/* Options Manager (only for select type) */}
            {fieldType === 'select' && (
              <div className="space-y-3">
                <Label>Dropdown Options</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Users will only be able to select from these values
                </p>

                {/* Current options */}
                {options.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt) => (
                      <Badge
                        key={opt}
                        variant="secondary"
                        className="gap-1 pl-2.5 pr-1 py-1 text-sm"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt)}
                          className="rounded-full p-0.5 hover:bg-background/50 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No options added yet
                  </p>
                )}

                {/* Add new option */}
                <div className="flex gap-2">
                  <Input
                    id="config-new-option"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type an option…"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddOption}
                    disabled={!newOption.trim()}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
