import type { Solicitation } from '@/lib/solicitations'
import type { FieldConfig } from '@/lib/fieldConfigs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Pencil, Trash2 } from 'lucide-react'

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Pending: 'outline',
  Ongoing: 'default',
  Done: 'secondary',
  Discontinued: 'destructive',
}

interface SolicitationDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitation: Solicitation | null
  fieldConfigs: FieldConfig[]
  onEdit: (s: Solicitation) => void
  onDelete: (s: Solicitation) => void
}

export function SolicitationDetailSheet({
  open,
  onOpenChange,
  solicitation,
  fieldConfigs,
  onEdit,
  onDelete,
}: SolicitationDetailSheetProps) {
  if (!solicitation) return null

  const formatValue = (config: FieldConfig, value: unknown): string => {
    if (value == null || value === '') return '—'

    if (config.field_type === 'date') {
      try {
        return new Date(String(value)).toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      } catch {
        return String(value)
      }
    }

    return String(value)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-3">
            <span>Solicitation Details</span>
            {solicitation.status && (
              <Badge variant={statusVariantMap[solicitation.status] ?? 'outline'}>
                {solicitation.status}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {solicitation.organization_name || 'Record'}{' '}
            {solicitation.control_number && `· #${solicitation.control_number}`}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-4 py-4">
            {fieldConfigs.map((config) => {
              const solicitRecord = solicitation as unknown as Record<string, unknown>
              const value = solicitRecord[config.field_name]
              const display = formatValue(config, value)

              return (
                <div key={config.field_name} className="space-y-0.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {config.label}
                  </dt>
                  <dd className="text-sm text-foreground flex items-center gap-2">
                    {config.field_name === 'status' && value ? (
                      <Badge variant={statusVariantMap[String(value)] ?? 'outline'}>
                        {String(value)}
                      </Badge>
                    ) : (
                      <span className={display === '—' ? 'text-muted-foreground' : ''}>
                        {display}
                      </span>
                    )}
                    {config.field_name === 'control_number' && solicitation.control_number_color && (() => {
                      const mapping = config.color_mappings?.find(m => m.color === solicitation.control_number_color)
                      return (
                        <Badge 
                          style={{ backgroundColor: solicitation.control_number_color, color: '#fff' }} 
                          variant="outline" 
                          className="border-0 text-xs px-1.5 py-0"
                          title={mapping?.label || 'Color'}
                        >
                          {mapping?.label || '—'}
                        </Badge>
                      )
                    })()}
                  </dd>
                </div>
              )
            })}

            {/* Timestamps */}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Created
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {new Date(solicitation.created_at).toLocaleString('en-PH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Updated
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {new Date(solicitation.updated_at).toLocaleString('en-PH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </dd>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => onDelete(solicitation)}
          >
            <Trash2 size={14} />
            Delete
          </Button>
          <Button size="sm" className="gap-2" onClick={() => onEdit(solicitation)}>
            <Pencil size={14} />
            Edit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
