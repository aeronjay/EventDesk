import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Service-role client, used to identify the caller and write the send log
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN secret. Set it with: npx supabase secrets set TELEGRAM_BOT_TOKEN=your-token")
    }

    const { solicitation, chat_id } = await req.json()

    if (!chat_id) {
      throw new Error("Missing chat_id. Configure it in Settings > Telegram Integration.")
    }

    if (!solicitation) {
      throw new Error("Missing solicitation data.")
    }

    const sender = await getSender(req)

    let message_id: number | null
    try {
      message_id = await deliver(solicitation, chat_id)
    } catch (sendError) {
      await logSend({ solicitation, chat_id, sender, status: 'failed', error: sendError.message })
      throw sendError
    }

    await logSend({ solicitation, chat_id, sender, status: 'success', message_id })

    return new Response(JSON.stringify({ success: true, message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

// Formats the solicitation and posts it to Telegram. Returns the message id
// of the text/caption message, or throws if the details were not delivered.
async function deliver(solicitation: any, chat_id: string): Promise<number | null> {
  // Format the event date nicely
  let eventDateStr = solicitation.event_date || '—'
  if (solicitation.event_date) {
    try {
      eventDateStr = new Date(solicitation.event_date).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch { /* keep original */ }
  }

  // Format event time
  let eventTimeStr = ''
  if (solicitation.event_time) {
    const timeStr = String(solicitation.event_time)
    const match = timeStr.match(/(\d{1,2}):(\d{2})/)
    if (match) {
      let hours = parseInt(match[1], 10)
      const mins = match[2]
      const ampmMatch = timeStr.match(/(AM|PM)/i)
      let ampm = ampmMatch ? ampmMatch[1].toUpperCase() : (hours >= 12 ? 'PM' : 'AM')
      hours = hours % 12 || 12
      eventTimeStr = `${hours}:${mins} ${ampm}`
    }
  }

  // Build attachment section
  let attachmentSection = ''
  let fileAttachments: any[] = []
  let imageAttachments: any[] = []

  if (solicitation.attachments) {
    let atts = solicitation.attachments
    if (typeof atts === 'string') {
      try { atts = JSON.parse(atts) } catch { atts = [] }
    }
    if (Array.isArray(atts) && atts.length > 0) {
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp)$/i
      for (const att of atts) {
        if (att.name && imageExtensions.test(att.name)) {
          imageAttachments.push(att)
        } else {
          fileAttachments.push(att)
        }
      }
    }
  }

  if (fileAttachments.length > 0) {
    const fileLinks = fileAttachments.map((att: any) => {
      const name = escapeHtml(att.name || 'File')
      const url = att.url || '#'
      return `  📄 <a href="${url}">${name}</a>`
    }).join('\n')
    attachmentSection = `\n📎 <b>Attachments</b>\n${fileLinks}`
    if (imageAttachments.length > 0) {
      attachmentSection += `\n  <i>(+${imageAttachments.length} image${imageAttachments.length > 1 ? 's' : ''})</i>`
    }
  } else if (imageAttachments.length > 0) {
    attachmentSection = `\n📎 <b>Attachments</b>\n  <i>${imageAttachments.length} image${imageAttachments.length > 1 ? 's' : ''} attached</i>`
  } else {
    attachmentSection = `\n📎 <b>Attachments</b>\n  <i>No attachments</i>`
  }

  const e = escapeHtml
  const type = e(solicitation.type || '—')
  const controlNo = e(solicitation.control_number || '—')
  const barangay = e(solicitation.control_number_color || '—')
  const eventText = e(solicitation.event || '—')
  const org = e(solicitation.organization_name || '—')
  const request = e(solicitation.request || '—')
  const recomText = e(solicitation.recom || '—')
  const venue = e(solicitation.venue || '—')
  const contact = e(solicitation.contact_person || '—')
  const contactNum = e(solicitation.contact_number || 'N/A')
  const dateTime = eventTimeStr
    ? `${e(eventDateStr)}  ·  ${e(eventTimeStr)}`
    : e(eventDateStr)

  // Build the Telegram message using HTML parse mode (more mobile-friendly)
  const message = `📋 <b>SOLICITATION DETAILS</b>

<b>Barangay:</b>  ${barangay}

🏢 <b>Name of Organization/Solicitor</b>
  ${org}

🎉<b>Event</b>
 ${eventText}

📝 <b>Request</b>
  ${request}

✅ <b>Recom</b>
  ${recomText}

📅 <b>Event Date & Time</b>
  ${dateTime}

📍 <b>Venue</b>
  ${venue}

👤 <b>Contact</b>
  ${contact}

${attachmentSection}`

  const isCaptionValid = message.length <= 1024;
  let messageSentAsCaption = false;
  let message_id: number | null = null;

  // Try to send images first (and include message as caption if it fits).
  // The caption only counts as sent when Telegram accepts the request;
  // otherwise we fall back to a plain text message below.
  if (imageAttachments.length > 0) {
    try {
      if (imageAttachments.length === 1) {
        const photoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`
        const payload: any = {
          chat_id: chat_id,
          photo: imageAttachments[0].url,
          parse_mode: 'HTML',
        }
        if (isCaptionValid) {
          payload.caption = message;
        }

        const res = await fetch(photoUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.ok) {
          if (isCaptionValid) {
            messageSentAsCaption = true
            message_id = data.result?.message_id ?? null
          }
        } else {
          console.error('Telegram API photo error:', data)
        }
      } else {
        // Send as media group
        const mediaUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`
        const media = imageAttachments.map((att, idx) => {
          const m: any = { type: 'photo', media: att.url }
          if (idx === 0 && isCaptionValid) {
            m.caption = message
            m.parse_mode = 'HTML'
          }
          return m
        })

        const res = await fetch(mediaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat_id,
            media: media,
          }),
        })
        const data = await res.json()
        if (data.ok) {
          if (isCaptionValid) {
            messageSentAsCaption = true
            message_id = data.result?.[0]?.message_id ?? null
          }
        } else {
          console.error('Telegram API media group error:', data)
        }
      }
    } catch (imgError) {
      console.error('Error sending images to Telegram:', imgError)
    }
  }

  // Send the text message separately if it wasn't sent as a caption
  if (!messageSentAsCaption) {
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    const telegramRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat_id,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    const telegramData = await telegramRes.json()

    if (!telegramData.ok) {
      console.error('Telegram API error:', telegramData)
      throw new Error(`Telegram API error: ${telegramData.description || 'Unknown error'}`)
    }
    message_id = telegramData.result?.message_id ?? null
  }

  return message_id
}

// Resolve the calling user from their JWT (null if it can't be determined)
async function getSender(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!supabase || !token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error) {
    console.error('Failed to resolve sender:', error)
    return null
  }
  return data.user
}

// Record the attempt in telegram_sends. A logging failure never fails the send.
async function logSend(entry: {
  solicitation: any
  chat_id: string
  sender: { id: string; email?: string } | null
  status: 'success' | 'failed'
  message_id?: number | null
  error?: string
}) {
  if (!supabase) {
    console.error('Cannot log Telegram send: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return
  }
  const { solicitation, chat_id, sender, status, message_id, error } = entry
  const { error: insertError } = await supabase.from('telegram_sends').insert({
    solicitation_id: solicitation.id ?? null,
    sent_by: sender?.id ?? null,
    sent_by_email: sender?.email ?? null,
    chat_id: String(chat_id),
    status,
    error: error ?? null,
    message_id: message_id ?? null,
    control_number: solicitation.control_number ?? null,
    organization_name: solicitation.organization_name ?? null,
    event: solicitation.event ?? null,
    event_date: solicitation.event_date ?? null,
  })
  if (insertError) console.error('Failed to log Telegram send:', insertError)
}

// Escape special characters for HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
