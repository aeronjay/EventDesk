import type { Solicitation } from '@/lib/solicitations'
import { TERMS } from '@/lib/appName'
import type { FieldConfig } from '@/lib/fieldConfigs'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Pencil, Trash2, X, FileText, Image as ImageIcon, File, Download, Send, Loader2 } from 'lucide-react'
import { sendToTelegram } from '@/lib/telegram'
import { toast } from 'sonner'
import { useState } from 'react'

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success'> = {
  Pending: 'outline',
  Ongoing: 'default',
  Done: 'success',
  Discontinued: 'destructive',
}

interface SolicitationDetailPanelProps {
  solicitation: Solicitation | null
  fieldConfigs: FieldConfig[]
  onEdit: (s: Solicitation) => void
  onDelete: (s: Solicitation) => void
  onClose: () => void
  onStatusChange?: (s: Solicitation, newStatus: string) => void
}

export function SolicitationDetailPanel({
  solicitation,
  fieldConfigs,
  onEdit,
  onDelete,
  onClose,
  onStatusChange,
}: SolicitationDetailPanelProps) {
  const [sendingTelegram, setSendingTelegram] = useState(false)

  if (!solicitation) return null

  const handleSendToTelegram = async () => {
    setSendingTelegram(true)
    try {
      const result = await sendToTelegram(solicitation)
      if (result.success) {
        toast.success('Sent to Telegram successfully!')
      } else {
        toast.error(result.error || 'Failed to send to Telegram')
      }
    } catch (error) {
      toast.error('Failed to send to Telegram')
    } finally {
      setSendingTelegram(false)
    }
  }

  const statusOptions = fieldConfigs.find((c) => c.field_name === 'status')?.options ?? []

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
            <span>{solicitation.organization_name || `${TERMS.One} Details`}</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                {solicitation.status && (
                  <Badge variant={(statusVariantMap[solicitation.status] as any) ?? 'outline'} className="hover:opacity-80 transition-opacity cursor-pointer">
                    {solicitation.status}
                  </Badge>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {statusOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt}
                    onClick={() => onStatusChange?.(solicitation, opt)}
                  >
                    {opt}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control No: {solicitation.control_number || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(solicitation)} className="h-8 w-8 text-muted-foreground hover:text-primary">
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mr-2">
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          {fieldConfigs.map((config) => {
            if (config.field_name === 'event_time' || config.field_name === 'contact_number') return null;

            const solicitRecord = solicitation as unknown as Record<string, unknown>
            const value = solicitRecord[config.field_name]
            const display = formatValue(config, value)

            if (config.field_name === 'event_date') {
              const timeConfig = fieldConfigs.find(c => c.field_name === 'event_time');
              const timeValue = timeConfig ? solicitRecord[timeConfig.field_name] : null;
              const timeDisplay = timeConfig ? formatValue(timeConfig, timeValue) : '—';

              return (
                <div key={config.field_name} className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {config.label}
                    </dt>
                    <dd className="text-sm text-foreground flex items-center gap-2 mt-1">
                      <span className={display === '—' ? 'text-muted-foreground' : ''}>
                        {display}
                      </span>
                    </dd>
                  </div>
                  {timeConfig && (
                    <div className="space-y-0.5">
                      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {timeConfig.label}
                      </dt>
                      <dd className="text-sm text-foreground flex items-center gap-2 mt-1">
                        <span className={timeDisplay === '—' ? 'text-muted-foreground' : ''}>
                          {timeDisplay}
                        </span>
                      </dd>
                    </div>
                  )}
                </div>
              )
            }

            if (config.field_name === 'contact_person') {
              const numberConfig = fieldConfigs.find(c => c.field_name === 'contact_number');
              const numberValue = numberConfig ? solicitRecord[numberConfig.field_name] : null;
              const numberDisplay = numberConfig ? formatValue(numberConfig, numberValue) : '—';

              return (
                <div key={config.field_name} className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {config.label}
                    </dt>
                    <dd className="text-sm text-foreground flex items-center gap-2 mt-1">
                      <span className={display === '—' ? 'text-muted-foreground' : ''}>
                        {display}
                      </span>
                    </dd>
                  </div>
                  {numberConfig && (
                    <div className="space-y-0.5">
                      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {numberConfig.label}
                      </dt>
                      <dd className="text-sm text-foreground flex items-center gap-2 mt-1">
                        <span className={numberDisplay === '—' ? 'text-muted-foreground' : ''}>
                          {numberDisplay}
                        </span>
                      </dd>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div key={config.field_name} className="space-y-0.5">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {config.label}
                </dt>
                <dd className="text-sm text-foreground flex items-center gap-2 mt-1">
                  {config.field_name === 'status' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none">
                        {value ? (
                          <Badge variant={(statusVariantMap[String(value)] as any) ?? 'outline'} className="hover:opacity-80 transition-opacity cursor-pointer">
                            {String(value)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">—</span>
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {statusOptions.map((opt) => (
                          <DropdownMenuItem
                            key={opt}
                            onClick={() => onStatusChange?.(solicitation, opt)}
                          >
                            {opt}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className={display === '—' ? 'text-muted-foreground' : ''}>
                      {display}
                    </span>
                  )}
                  {config.field_name === 'control_number' && solicitation.control_number_color && (() => {
                    const mapping = config.color_mappings?.find(m => m.label === solicitation.control_number_color)
                    return (
                      <Badge 
                        style={{ backgroundColor: mapping?.color || '#ccc', color: '#fff' }} 
                        variant="outline" 
                        className="border-0 text-xs px-1.5 py-0"
                        title={mapping?.label || solicitation.control_number_color}
                      >
                        {mapping?.label || solicitation.control_number_color}
                      </Badge>
                    )
                  })()}
                </dd>
              </div>
            )
          })}

          {/* Attachments */}
          {(() => {
            let atts = solicitation.attachments
            if (typeof atts === 'string') {
              try { atts = JSON.parse(atts) } catch (e) { atts = [] }
            }
            if (!Array.isArray(atts) || atts.length === 0) return null
            
            return (
              <>
                <Separator />
                <div className="pt-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                    Attachments
                  </dt>
                  <dd className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {atts.map((att: any, i: number) => {
                      const name = att.name || 'Attachment'
                      const url = att.url || '#'
                      const isImage = name.match(/\.(jpeg|jpg|png|gif)$/i)
                      const isPdf = name.endsWith('.pdf')
                    return (
                      <a 
                        key={i} 
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-2 rounded-md border bg-muted/20 hover:bg-muted/40 transition-colors group"
                      >
                        <div className="shrink-0 p-2 bg-background rounded-md shadow-sm">
                          {isImage ? <ImageIcon className="w-4 h-4 text-blue-500" /> : isPdf ? <FileText className="w-4 h-4 text-red-500" /> : <File className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">{name}</p>
                        </div>
                        <Download className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </a>
                    )
                  })}
                </dd>
              </div>
            </>
          )
        })()}

          {/* Timestamps */}
          <Separator />
          <div className="pt-2">
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
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between px-6 py-4 bg-muted/10">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => onDelete(solicitation)}
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleSendToTelegram}
          disabled={sendingTelegram}
        >
          {sendingTelegram ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {sendingTelegram ? 'Sending...' : 'Send to Telegram'}
        </Button>
      </div>
    </div>
  )
}
