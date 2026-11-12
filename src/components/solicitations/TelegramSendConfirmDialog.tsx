import type { Solicitation } from '@/lib/solicitations'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Send } from 'lucide-react'

// Mirrors the message built in supabase/functions/send-telegram/index.ts.
// Keep the two in sync when the Telegram message format changes.

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i

type Attachment = { name?: string; url?: string }

function parseAttachments(raw: unknown): Attachment[] {
  let atts = raw
  if (typeof atts === 'string') {
    try { atts = JSON.parse(atts) } catch { atts = [] }
  }
  return Array.isArray(atts) ? atts : []
}

function formatEventDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

function formatEventTime(value: unknown): string {
  if (!value) return ''
  const timeStr = String(value)
  const match = timeStr.match(/(\d{1,2}):(\d{2})/)
  if (!match) return ''
  let hours = parseInt(match[1], 10)
  const mins = match[2]
  const ampmMatch = timeStr.match(/(AM|PM)/i)
  const ampm = ampmMatch ? ampmMatch[1].toUpperCase() : (hours >= 12 ? 'PM' : 'AM')
  hours = hours % 12 || 12
  return `${hours}:${mins} ${ampm}`
}

interface TelegramSendConfirmDialogProps {
  solicitation: Solicitation
  /** Color configured for the solicitation's control_number_color, from field_configs color_mappings */
  colorGroupColor?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  sending: boolean
  alreadySent: boolean
}

export function TelegramSendConfirmDialog({
  solicitation,
  colorGroupColor,
  open,
  onOpenChange,
  onConfirm,
  sending,
  alreadySent,
}: TelegramSendConfirmDialogProps) {
  const attachments = parseAttachments(solicitation.attachments)
  const images = attachments.filter((a) => a.name && IMAGE_EXTENSIONS.test(a.name))
  const files = attachments.filter((a) => !(a.name && IMAGE_EXTENSIONS.test(a.name)))

  const eventDate = formatEventDate(solicitation.event_date as string | null)
  const eventTime = formatEventTime((solicitation as unknown as Record<string, unknown>).event_time)
  const dateTime = eventTime ? `${eventDate}  ·  ${eventTime}` : eventDate

  const sections: { label: string; value: string }[] = [
    { label: '🏢 Name of Organization/Solicitor', value: solicitation.organization_name || '—' },
    { label: '🎉 Event', value: solicitation.event || '—' },
    { label: '📝 Request', value: solicitation.request || '—' },
    { label: '✅ Recom', value: solicitation.recom || '—' },
    { label: '📅 Event Date & Time', value: dateTime },
    { label: '📍 Venue', value: solicitation.venue || '—' },
    { label: '👤 Contact', value: solicitation.contact_person || '—' },
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{alreadySent ? 'Send to Telegram again?' : 'Send to Telegram?'}</DialogTitle>
          <DialogDescription>
            This is the message that will be posted to the Telegram group.
            {alreadySent && ' It has already been sent before, so the group will get a duplicate.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 min-h-0">
        <div
          className="rounded-lg border border-l-4 bg-card p-3"
          style={{ borderLeftColor: colorGroupColor || undefined }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Control No.
              </p>
              <p className="text-lg font-semibold leading-tight break-words">
                {solicitation.control_number || '—'}
              </p>
            </div>
            {solicitation.control_number_color && (
              <Badge
                variant="outline"
                className="shrink-0 border-0 text-xs"
                style={{ backgroundColor: colorGroupColor || '#ccc', color: '#fff' }}
              >
                {solicitation.control_number_color}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm truncate">
            {solicitation.organization_name || '—'}
          </p>
          {solicitation.status && (
            <p className="text-xs text-muted-foreground">Status: {solicitation.status}</p>
          )}
        </div>

        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground -mb-1">
          Message preview
        </p>
        <div className="min-h-0 overflow-y-auto rounded-lg border bg-muted/30 p-3">
          {images.length > 0 && (
            <div className={`mb-3 grid gap-1 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.name}
                  className="w-full max-h-48 rounded-md object-cover bg-muted"
                />
              ))}
            </div>
          )}

          <div className="space-y-3 text-sm whitespace-pre-wrap break-words">
            <p className="font-semibold">📋 SOLICITATION DETAILS</p>
            <p>
              <span className="font-semibold">Barangay:</span>{'  '}
              {solicitation.control_number_color || '—'}
            </p>
            {sections.map((s) => (
              <div key={s.label}>
                <p className="font-semibold">{s.label}</p>
                <p className="pl-2">{s.value}</p>
              </div>
            ))}
            <div>
              <p className="font-semibold">📎 Attachments</p>
              {files.length > 0 ? (
                <>
                  {files.map((f, i) => (
                    <p key={i} className="pl-2">
                      📄{' '}
                      <a href={f.url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                        {f.name || 'File'}
                      </a>
                    </p>
                  ))}
                  {images.length > 0 && (
                    <p className="pl-2 italic text-muted-foreground">
                      (+{images.length} image{images.length > 1 ? 's' : ''})
                    </p>
                  )}
                </>
              ) : images.length > 0 ? (
                <p className="pl-2 italic text-muted-foreground">
                  {images.length} image{images.length > 1 ? 's' : ''} attached
                </p>
              ) : (
                <p className="pl-2 italic text-muted-foreground">No attachments</p>
              )}
            </div>
          </div>
        </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={sending} />}>
            Cancel
          </DialogClose>
          <Button onClick={onConfirm} disabled={sending} className="gap-2">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
