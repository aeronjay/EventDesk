// Who may delete what. Superadmins may delete anything; everyone else only
// their own items. These checks only hide buttons: the same rules are
// enforced server side by supabase/sql/solicitations_delete_policy.sql
// (solicitations) and the delete-telegram edge function (Telegram sends).

interface Viewer {
  userId: string | undefined
  isSuperAdmin: boolean
}

// A solicitation can be deleted by the user who created it
export function canDeleteSolicitation(
  solicitation: { created_by: string | null },
  { userId, isSuperAdmin }: Viewer
): boolean {
  return isSuperAdmin || (!!userId && solicitation.created_by === userId)
}

// A Telegram send can be deleted by the user who sent it, or by the user who
// created the solicitation it was about
export function canDeleteTelegramSend(
  send: { sent_by: string | null },
  solicitationCreatedBy: string | null | undefined,
  { userId, isSuperAdmin }: Viewer
): boolean {
  if (isSuperAdmin) return true
  if (!userId) return false
  return send.sent_by === userId || solicitationCreatedBy === userId
}
