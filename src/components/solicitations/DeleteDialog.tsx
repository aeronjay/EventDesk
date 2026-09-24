import type { Solicitation } from '@/lib/solicitations'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitation: Solicitation | null
  onConfirm: () => Promise<void>
}

export function DeleteDialog({
  open,
  onOpenChange,
  solicitation,
  onConfirm,
}: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  if (!solicitation) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle size={24} className="text-destructive" />
          </div>
          <DialogTitle className="text-center">Delete Solicitation</DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to delete the solicitation
            {solicitation.control_number && (
              <> <strong>#{solicitation.control_number}</strong></>
            )}
            {solicitation.organization_name && (
              <> for <strong>{solicitation.organization_name}</strong></>
            )}
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
            className="gap-2"
          >
            {deleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
