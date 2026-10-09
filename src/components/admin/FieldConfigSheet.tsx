import { useState, useEffect } from 'react'
import type { FieldConfig, ColorMapping } from '@/lib/fieldConfigs'
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
import { Save, Loader2, Plus, X, ArrowUp, ArrowDown } from 'lucide-react'

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
  const [defaultValue, setDefaultValue] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [colorMappings, setColorMappings] = useState<ColorMapping[]>([])
  const [newOption, setNewOption] = useState('')
  
  // New color mapping form state
  const [newMappingColor, setNewMappingColor] = useState('#eab308')
  const [newMappingLabel, setNewMappingLabel] = useState('')
  
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && fieldConfig) {
      setFieldType(fieldConfig.field_type)
      setIsRequired(fieldConfig.is_required)
      setValidationRule(fieldConfig.validation_rule ?? '')
      setDefaultValue(fieldConfig.default_value ?? '')
      setOptions(fieldConfig.options ?? [])
      setColorMappings(fieldConfig.color_mappings ?? [])
      setNewOption('')
      setNewMappingColor('#eab308')
      setNewMappingLabel('')
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

  const handleAddMapping = () => {
    if (!newMappingLabel.trim()) return
    setColorMappings((prev) => [
      ...prev,
      { color: newMappingColor, label: newMappingLabel.trim() }
    ])
    setNewMappingLabel('')
  }

  const handleRemoveMapping = (index: number) => {
    setColorMappings((prev) => prev.filter((_, i) => i !== index))
  }

  const handleMoveMapping = (index: number, direction: 'up' | 'down') => {
    setColorMappings((prev) => {
      const result = [...prev]
      if (direction === 'up' && index > 0) {
        const temp = result[index - 1]
        result[index - 1] = result[index]
        result[index] = temp
      } else if (direction === 'down' && index < result.length - 1) {
        const temp = result[index + 1]
        result[index + 1] = result[index]
        result[index] = temp
      }
      return result
    })
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
        default_value: defaultValue.trim() || null,
        color_mappings: colorMappings.length > 0 ? colorMappings : null,
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

            {/* Default Value */}
            <div className="space-y-1.5">
              <Label htmlFor="config-default-value">Default Value</Label>
              {fieldType === 'select' ? (
                <Select value={defaultValue} onValueChange={(v) => v && setDefaultValue(v === 'none' ? '' : v)}>
                  <SelectTrigger id="config-default-value">
                    <SelectValue placeholder="Select a default value..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Default</SelectItem>
                    {options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="config-default-value"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="e.g. N/A"
                  className="text-sm"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Optional default value for new solicitations
              </p>
            </div>

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

            {/* Color Mappings */}
            {fieldConfig.field_name === 'control_number' && (
              <div className="space-y-3 pt-2">
                <Label>Color & Group Mapping</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Define available colors and labels (e.g., "Group A") that users can pick for this field.
                </p>

                {colorMappings.length > 0 ? (
                  <div className="space-y-2">
                    {colorMappings.map((cm, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
                        <div className="flex-1 flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-border" 
                            style={{ backgroundColor: cm.color }} 
                          />
                          <span className="text-sm font-medium">{cm.label}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveMapping(idx, 'up')}
                            disabled={idx === 0}
                            className="rounded p-1 hover:bg-muted-foreground/10 text-muted-foreground transition-colors disabled:opacity-30"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveMapping(idx, 'down')}
                            disabled={idx === colorMappings.length - 1}
                            className="rounded p-1 hover:bg-muted-foreground/10 text-muted-foreground transition-colors disabled:opacity-30"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMapping(idx)}
                            className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No color mappings added yet
                  </p>
                )}

                <div className="flex flex-col gap-2 mt-2 border rounded-md p-3 bg-muted/20">
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 border rounded-md px-2 bg-background h-8">
                      <input
                        type="color"
                        value={newMappingColor}
                        onChange={(e) => setNewMappingColor(e.target.value)}
                        className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                      />
                      <Input
                        value={newMappingColor}
                        onChange={(e) => setNewMappingColor(e.target.value)}
                        placeholder="#000000"
                        className="w-20 border-0 focus-visible:ring-0 px-1 text-sm h-7"
                      />
                    </div>
                    <Input
                      placeholder="Label (e.g. Group A)"
                      value={newMappingLabel}
                      onChange={(e) => setNewMappingLabel(e.target.value)}
                      className="flex-1 text-sm h-8"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={handleAddMapping}
                      disabled={!newMappingLabel.trim()}
                    >
                      <Plus size={14} /> Add
                    </Button>
                  </div>
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
