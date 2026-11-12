import type { Solicitation } from '@/lib/solicitations'
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
import { Pencil, Trash2, X, FileText, Image as ImageIcon, File, Download, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { sendToTelegram, fetchTelegramSendsFor, isActiveSend, type TelegramSend } from '@/lib/telegram'
import { toast } from 'sonner'
import { useState, useEffect, useCallback } from 'react'
import { TelegramSendConfirmDialog } from './TelegramSendConfirmDialog'
import { TelegramDeleteConfirmDialog } from '@/components/telegram/TelegramDeleteConfirmDialog'
import { canDeleteSolicitation, canDeleteTelegramSend } from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'
import { fetchUserEmails } from '@/lib/users'

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
  const { user, isSuperAdmin } = useAuth()
  const [sendingTelegram, setSendingTelegram] = useState(false)
  const [confirmTelegramOpen, setConfirmTelegramOpen] = useState(false)
  const [telegramSends, setTelegramSends] = useState<TelegramSend[]>([])
  const [sendToDelete, setSendToDelete] = useState<TelegramSend | null>(null)

  const solicitationId = solicitation?.id
  const loadTelegramSends = useCallback(async () => {
    if (!solicitationId) return
    try {
      setTelegramSends(await fetchTelegramSendsFor(solicitationId))
    } catch (error) {
      console.error('Failed to load Telegram send history:', error)
    }
  }, [solicitationId])

  useEffect(() => {
    setTelegramSends([])
    loadTelegramSends()
  }, [loadTelegramSends])

  // Email of the user who created the solicitation
  const createdBy = solicitation?.created_by ?? null
  const [creatorEmail, setCreatorEmail] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setCreatorEmail(null)
    if (!createdBy) return
    fetchUserEmails([createdBy])
      .then((emails) => { if (!cancelled) setCreatorEmail(emails[createdBy] ?? null) })
      .catch((error) => console.error('Failed to load creator email:', error))
    return () => { cancelled = true }
  }, [createdBy])

  if (!solicitation) return null

  // Sends deleted from Telegram no longer count as sent
  const successfulSends = telegramSends.filter(isActiveSend)
  const deletedSends = telegramSends.filter((s) => s.deleted_at)
  const viewer = { userId: user?.id, isSuperAdmin }

  const handleSendToTelegram = async () => {
    setSendingTelegram(true)
    try {
      const result = await sendToTelegram(solicitation)
      if (result.success) {
        toast.success('Sent to Telegram successfully!')
        setConfirmTelegramOpen(false)
      } else {
        toast.error(result.error || 'Failed to send to Telegram')
      }
    } catch (error) {
      toast.error('Failed to send to Telegram')
    } finally {
      setSendingTelegram(false)
      loadTelegramSends()
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
            <span>{solicitation.organization_name || 'Solicitation Details'}</span>
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
          {successfulSends.length > 0 && (
            <Badge variant="success" className="mt-2 gap-1" title={`Last sent ${new Date(successfulSends[0].sent_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`}>
              <Send />
              Sent to Telegram{successfulSends.length > 1 ? ` ×${successfulSends.length}` : ''}
            </Badge>
          )}
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

          {/* Telegram send history */}
          <Separator />
          <div className="pt-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Telegram History
            </dt>
            {telegramSends.length === 0 ? (
              <dd className="text-sm text-muted-foreground">Not sent to Telegram yet</dd>
            ) : (
              <>
                <dd className="text-sm text-foreground mb-3">
                  {successfulSends.length > 0
                    ? `Sent ${successfulSends.length} time${successfulSends.length > 1 ? 's' : ''}, last on ${new Date(successfulSends[0].sent_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`
                    : deletedSends.length > 0
                      ? 'Not on Telegram. Earlier sends were deleted.'
                      : 'Never sent successfully'}
                </dd>
                <dd className="space-y-2">
                  {telegramSends.map((send) => (
                    <div key={send.id} className="flex items-start gap-2 text-sm">
                      {send.deleted_at ? (
                        <Trash2 size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                      ) : send.status === 'success' ? (
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
                      ) : (
                        <XCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={send.deleted_at ? 'text-muted-foreground' : 'text-foreground'}>
                          {send.status === 'success' ? 'Sent' : 'Failed'}
                          {' · '}
                          {new Date(send.sent_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          by {send.sent_by_email || 'Unknown user'}
                        </p>
                        {send.deleted_at && (
                          <>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Deleted from Telegram · {new Date(send.deleted_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                            <p className="text-xs text-muted-foreground break-all">
                              by {send.deleted_by_email || 'Unknown user'}
                            </p>
                          </>
                        )}
                        {send.error && (
                          <p className="text-xs text-destructive break-words">{send.error}</p>
                        )}
                      </div>
                      {isActiveSend(send) && canDeleteTelegramSend(send, solicitation.created_by, viewer) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => setSendToDelete(send)}
                        >
                          <Trash2 size={12} />
                          Delete
                        </Button>
                      )}
                    </div>
                  ))}
                </dd>
              </>
            )}
          </div>

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
              {(() => {
                // Fall back to the signed-in user's own email for their records
                const email = creatorEmail ?? (createdBy && createdBy === user?.id ? user?.email : null)
                return email ? (
                  <dd className="text-xs text-muted-foreground break-all">by {email}</dd>
                ) : null
              })()}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between px-6 py-4 bg-muted/10">
        <div className="flex items-center gap-2">
          {canDeleteSolicitation(solicitation, viewer) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => onDelete(solicitation)}
            >
              <Trash2 size={14} />
              Delete
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setConfirmTelegramOpen(true)}
          disabled={sendingTelegram}
        >
          {sendingTelegram ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {sendingTelegram ? 'Sending...' : successfulSends.length > 0 ? 'Send Again' : 'Send to Telegram'}
        </Button>
      </div>

      <TelegramSendConfirmDialog
        solicitation={solicitation}
        colorGroupColor={
          fieldConfigs
            .find((c) => c.field_name === 'control_number')
            ?.color_mappings?.find((m) => m.label === solicitation.control_number_color)?.color
        }
        open={confirmTelegramOpen}
        onOpenChange={setConfirmTelegramOpen}
        onConfirm={handleSendToTelegram}
        sending={sendingTelegram}
        alreadySent={successfulSends.length > 0}
      />

      <TelegramDeleteConfirmDialog
        send={sendToDelete}
        onOpenChange={(open) => { if (!open) setSendToDelete(null) }}
        onDeleted={loadTelegramSends}
      />
    </div>
  )
}
