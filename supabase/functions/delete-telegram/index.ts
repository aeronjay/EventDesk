import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

// Deletes the Telegram messages created by one send-telegram call and marks
// the telegram_sends row as deleted, so the solicitation no longer counts as sent.

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN secret.")
    }
    if (!supabase) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: userData, error: userError } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null }, error: null }
    const user = userData?.user
    if (userError || !user) {
      return json({ error: 'You must be signed in to delete a Telegram message.' }, 401)
    }

    const { send_id } = await req.json()
    if (!send_id) {
      throw new Error("Missing send_id.")
    }

    const { data: send, error: fetchError } = await supabase
      .from('telegram_sends')
      .select('id, chat_id, status, message_id, message_ids, deleted_at, sent_by, solicitation_id')
      .eq('id', send_id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!send) throw new Error("Telegram send not found.")
    if (send.status !== 'success') throw new Error("Only successful sends can be deleted.")
    if (send.deleted_at) throw new Error("This message was already deleted from Telegram.")

    // Superadmins may delete any send. Everyone else only sends they made,
    // or sends of solicitations they created.
    // Mirrors canDeleteTelegramSend in src/lib/permissions.ts.
    if (!(await canDelete(user.id, send))) {
      return json({ error: "You can only delete Telegram messages you sent, or for events you created." }, 403)
    }

    // Older sends only recorded the text/caption message id
    const ids: number[] = (send.message_ids?.length ? send.message_ids : [send.message_id])
      .filter((id: number | null) => id != null)
      .map(Number)

    if (ids.length === 0) {
      throw new Error("No Telegram message id was recorded for this send, so it can't be deleted from here.")
    }

    // deleteMessages skips messages that no longer exist (e.g. already removed
    // by hand in Telegram) and fails if any of them can't be deleted.
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: send.chat_id, message_ids: ids }),
    })
    const data = await res.json()

    if (!data.ok) {
      console.error('Telegram API delete error:', data)
      const description: string = data.description || 'Unknown error'
      if (/can't be deleted/i.test(description)) {
        throw new Error(
          "Telegram refused to delete this message. Bots can only delete messages sent in the last 48 hours. Delete it by hand in Telegram instead."
        )
      }
      throw new Error(`Telegram API error: ${description}`)
    }

    const { error: updateError } = await supabase
      .from('telegram_sends')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        deleted_by_email: user.email ?? null,
      })
      .eq('id', send.id)
      .is('deleted_at', null)

    if (updateError) {
      console.error('Deleted from Telegram but failed to update telegram_sends:', updateError)
      throw new Error("The message was deleted from Telegram, but the log could not be updated.")
    }

    return json({ success: true }, 200)
  } catch (error) {
    console.error(error)
    return json({ error: error.message }, 400)
  }
})

async function canDelete(
  userId: string,
  send: { sent_by: string | null; solicitation_id: string | null }
): Promise<boolean> {
  if (send.sent_by === userId) return true

  const { data: profile, error: profileError } = await supabase!
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError
  if (profile?.role === 'superadmin') return true

  if (!send.solicitation_id) return false
  const { data: solicitation, error: solicitationError } = await supabase!
    .from('solicitations')
    .select('created_by')
    .eq('id', send.solicitation_id)
    .maybeSingle()
  if (solicitationError) throw solicitationError
  return solicitation?.created_by === userId
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}
