import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

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
    let hasAttachments = false
    if (solicitation.attachments) {
      let atts = solicitation.attachments
      if (typeof atts === 'string') {
        try { atts = JSON.parse(atts) } catch { atts = [] }
      }
      if (Array.isArray(atts) && atts.length > 0) {
        hasAttachments = true
        const fileLinks = atts.map((att: any) => {
          const name = escapeHtml(att.name || 'File')
          const url = att.url || '#'
          return `  📄 <a href="${url}">${name}</a>`
        }).join('\n')
        attachmentSection = `\n📎 <b>Attachments</b>\n${fileLinks}`
      }
    }
    if (!hasAttachments) {
      attachmentSection = `\n📎 <b>Attachments</b>\n  <i>No attachments</i>`
    }

    const e = escapeHtml
    const type = e(solicitation.type || '—')
    const controlNo = e(solicitation.control_number || '—')
    const org = e(solicitation.organization_name || '—')
    const request = e(solicitation.request || '—')
    const venue = e(solicitation.venue || '—')
    const contact = e(solicitation.contact_person || '—')
    const contactNum = e(solicitation.contact_number || 'N/A')
    const dateTime = eventTimeStr
      ? `${e(eventDateStr)}  ·  ${e(eventTimeStr)}`
      : e(eventDateStr)

    // Build the Telegram message using HTML parse mode (more mobile-friendly)
    const message = `📋 <b>SOLICITATION DETAILS</b>
━━━━━━━━━━━━━━━━━━━━

<b>Type:</b>  ${type}
<b>Control No:</b>  ${controlNo}

🏢 <b>Name of Organization/Solicitor</b>
  ${org}

📝 <b>Request</b>
  ${request}

📅 <b>Event Date & Time</b>
  ${dateTime}

📍 <b>Venue</b>
  ${venue}

👤 <b>Contact</b>
  ${contact}
  📞 ${contactNum}
${attachmentSection}

━━━━━━━━━━━━━━━━━━━━
<i>Sent via QSolicit</i>`

    // Send via Telegram Bot API
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

    return new Response(JSON.stringify({ success: true, message_id: telegramData.result?.message_id }), {
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

// Escape special characters for HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

