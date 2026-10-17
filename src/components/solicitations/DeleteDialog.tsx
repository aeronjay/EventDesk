import type { Solicitation } from '@/lib/solicitations'
import { TERMS } from '@/lib/appName'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [confirmText, setConfirmText] = useState('')

  const expected = solicitation?.control_number?.trim() || 'DELETE'
  const isConfirmed = confirmText.trim() === expected

  const handleOpenChange = (next: boolean) => {
    if (!next) setConfirmText('')
    onOpenChange(next)
  }

  const handleConfirm = async () => {
    if (!isConfirmed) return
    setDeleting(true)
    try {
      await onConfirm()
      // Parent closes the dialog directly on success, so clear here too
      setConfirmText('')
    } finally {
      setDeleting(false)
    }
  }

  if (!solicitation) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle size={24} className="text-destructive" />
          </div>
          <DialogTitle className="text-center">Delete {TERMS.One}</DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to delete the {TERMS.one}
            {solicitation.control_number && (
              <> <strong>#{solicitation.control_number}</strong></>
            )}
            {solicitation.organization_name && (
              <> for <strong>{solicitation.organization_name}</strong></>
            )}
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirm()
          }}
        >
          <Label htmlFor="delete-confirm" className="text-sm font-normal">
            Type <strong className="font-mono">{expected}</strong> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
            autoFocus
          />
        </form>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting || !isConfirmed}
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
