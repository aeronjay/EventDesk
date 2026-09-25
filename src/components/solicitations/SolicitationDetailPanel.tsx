import type { Solicitation } from '@/lib/solicitations'
import type { FieldConfig } from '@/lib/fieldConfigs'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Pencil, Trash2, X } from 'lucide-react'

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Pending: 'outline',
  Ongoing: 'default',
  Done: 'secondary',
  Discontinued: 'destructive',
}

interface SolicitationDetailPanelProps {
  solicitation: Solicitation | null
  fieldConfigs: FieldConfig[]
  onEdit: (s: Solicitation) => void
  onDelete: (s: Solicitation) => void
  onClose: () => void
}

export function SolicitationDetailPanel({
  solicitation,
  fieldConfigs,
  onEdit,
  onDelete,
  onClose,
}: SolicitationDetailPanelProps) {
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
    
    if (config.field_type === 'time' || config.field_name.includes('time')) {
      const timeStr = String(value);
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        let hours = parseInt(match[1], 10);
        const mins = match[2];
        const ampmMatch = timeStr.match(/(AM|PM)/i);
        let ampm = ampmMatch ? ampmMatch[1].toUpperCase() : (hours >= 12 ? 'PM' : 'AM');
        hours = hours % 12 || 12;
        return `${hours}:${mins} ${ampm}`;
      }
    }

    return String(value)
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-muted/20">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-3">
            <span>Solicitation Details</span>
            {solicitation.status && (
              <Badge variant={statusVariantMap[solicitation.status] ?? 'outline'}>
                {solicitation.status}
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {solicitation.organization_name || 'Record'}{' '}
            {solicitation.control_number && `· #${solicitation.control_number}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mr-2">
          <X size={16} />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          {fieldConfigs.map((config) => {
            const solicitRecord = solicitation as unknown as Record<string, unknown>
            const value = solicitRecord[config.field_name]
            const display = formatValue(config, value)

            return (
              <div key={config.field_name} className="space-y-0.5">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {config.label}
                </dt>
                <dd className="text-sm text-foreground flex items-center gap-2 mt-1">
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
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-0.5">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Created
              </dt>
              <dd className="text-sm text-muted-foreground mt-1">
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
              <dd className="text-sm text-muted-foreground mt-1">
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

      <div className="flex items-center justify-between px-6 py-4 bg-muted/10">
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
    </div>
  )
}
