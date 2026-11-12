import { useState } from 'react'
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
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { deleteTelegramSend, TELEGRAM_DELETE_WINDOW_MS, type TelegramSend } from '@/lib/telegram'

interface TelegramDeleteConfirmDialogProps {
  /** The send to delete; the dialog is open while this is set */
  send: TelegramSend | null
  onOpenChange: (open: boolean) => void
  /** Called after the messages were deleted, to reload the data */
  onDeleted: () => void
}

export function TelegramDeleteConfirmDialog({ send, onOpenChange, onDeleted }: TelegramDeleteConfirmDialogProps) {
  const [deleting, setDeleting] = useState(false)

  const tooOld = send ? Date.now() - new Date(send.sent_at).getTime() > TELEGRAM_DELETE_WINDOW_MS : false

  const handleDelete = async () => {
    if (!send) return
    setDeleting(true)
    try {
      const result = await deleteTelegramSend(send.id)
      if (result.success) {
        toast.success('Deleted from Telegram')
        onOpenChange(false)
        onDeleted()
      } else {
        toast.error(result.error || 'Failed to delete from Telegram')
      }
    } catch {
      toast.error('Failed to delete from Telegram')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={send !== null} onOpenChange={(next) => { if (!deleting) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete from Telegram?</DialogTitle>
          <DialogDescription>
            The bot will remove this message
            {send?.control_number ? ` (Control No. ${send.control_number})` : ''} from the Telegram
            group for everyone. It stays in the log marked as deleted, and the solicitation will
            show as not sent.
          </DialogDescription>
        </DialogHeader>

        {send && (
          <p className="text-sm text-muted-foreground">
            Sent {new Date(send.sent_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
            {' by '}
            {send.sent_by_email || 'Unknown user'}
          </p>
        )}

        {tooOld && (
          <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <p>
              This was sent more than 48 hours ago. Telegram usually won't let the bot delete it,
              so you may need to delete it by hand in Telegram.
            </p>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={deleting} />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
