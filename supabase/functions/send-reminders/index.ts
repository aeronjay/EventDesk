import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import nodemailer from 'npm:nodemailer'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const GMAIL_ADDRESS = Deno.env.get('GMAIL_ADDRESS')
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GMAIL_ADDRESS || !GMAIL_APP_PASSWORD) {
      throw new Error("Missing required environment variables. Did you set GMAIL_ADDRESS and GMAIL_APP_PASSWORD?")
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: reminders, error } = await supabase.rpc('get_reminders_to_send')

    if (error) {
      throw new Error(`Failed to fetch reminders: ${error.message}`)
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ message: "No reminders to send today" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Found ${reminders.length} users to notify.`)

    // Connect to Gmail SMTP using Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_ADDRESS,
        pass: GMAIL_APP_PASSWORD
      }
    });

    for (const reminder of reminders) {
      let { user_email, user_name, solicitations } = reminder;

      // The RPC 'get_reminders_to_send' does not return the 'status' column.
      // We must fetch it manually to properly filter out 'done' and 'discontinued'.
      if (solicitations && solicitations.length > 0) {
        const ids = solicitations.map((s: any) => s.id);
        const { data: statusData } = await supabase
          .from('solicitations')
          .select('id, status')
          .in('id', ids);
          
        if (statusData) {
          const statusMap = new Map(statusData.map(row => [row.id, row.status?.toLowerCase() || '']));
          solicitations = solicitations.filter((s: any) => {
            const status = statusMap.get(s.id) || '';
            return status !== 'done' && status !== 'discontinued';
          });
        }
      }

      // If no valid solicitations left for this user, skip sending email
      if (solicitations.length === 0) {
        continue;
      }

      const now = new Date();
      // Adjust for Manila Time (UTC+8)
      const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const todayStr = phTime.toISOString().split('T')[0];
      const tomorrow = new Date(phTime.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const grouped = {
        today: [] as any[],
        tomorrow: [] as any[],
        upcoming: [] as any[]
      };

      for (const s of solicitations) {
        if (s.event_date === todayStr) {
          grouped.today.push(s);
        } else if (s.event_date === tomorrowStr) {
          grouped.tomorrow.push(s);
        } else {
          grouped.upcoming.push(s);
        }
      }

      const sortByDate = (items: any[]) => items.sort((a, b) => {
        const dateA = new Date(a.event_date || 0).getTime();
        const dateB = new Date(b.event_date || 0).getTime();
        return dateA - dateB;
      });

      grouped.today = sortByDate(grouped.today);
      grouped.tomorrow = sortByDate(grouped.tomorrow);
      grouped.upcoming = sortByDate(grouped.upcoming);

      const renderGroup = (items: any[], title: string) => {
        if (items.length === 0) return '';
        return `
          <div style="margin-bottom: 30px;">
            <h3 style="color: #0f172a; margin-top: 0; margin-bottom: 12px; font-size: 16px; font-weight: 600; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">${title}</h3>
            <div>
              ${items.map((s: any) => `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                  <div style="margin-bottom: 12px; display: table; width: 100%;">
                    <div style="display: table-cell; vertical-align: middle;">
                      <span style="display: inline-block; background-color: #e0f2fe; color: #0284c7; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${s.type || '-'}</span>
                    </div>
                    <div style="display: table-cell; vertical-align: middle; text-align: right; font-family: monospace; color: #64748b; font-weight: 600; font-size: 13px;">
                      ${s.control_number || '-'}
                    </div>
                  </div>
                  
                  <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 16px; font-weight: 600; line-height: 1.4;">${s.event || '-'}</h4>
                  <div style="color: #334155; font-size: 14px; margin-bottom: 12px; font-weight: 500;">${s.organization_name || '-'}</div>
                  
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #475569;">
                    <tr>
                      <td style="padding: 4px 0; width: 70px; vertical-align: top; color: #64748b; font-weight: 600;">When</td>
                      <td style="padding: 4px 0; vertical-align: top; color: #1e293b;">${s.event_date || '-'} <span style="color: #64748b; font-size: 12px;">${s.event_time || ''}</span></td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; vertical-align: top; color: #64748b; font-weight: 600;">Venue</td>
                      <td style="padding: 4px 0; vertical-align: top; color: #1e293b;">${s.venue || '-'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; vertical-align: top; color: #64748b; font-weight: 600;">Request</td>
                      <td style="padding: 4px 0; vertical-align: top; color: #1e293b;">${s.request || '-'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; vertical-align: top; color: #64748b; font-weight: 600;">Contact</td>
                      <td style="padding: 4px 0; vertical-align: top; color: #1e293b;">${s.contact_person || '-'} <span style="color: #64748b; font-size: 12px;">${s.contact_number ? `(${s.contact_number})` : ''}</span></td>
                    </tr>
                    ${s.additional_note ? `
                    <tr>
                      <td style="padding: 4px 0; vertical-align: top; color: #64748b; font-weight: 600;">Note</td>
                      <td style="padding: 4px 0; vertical-align: top; font-style: italic; color: #64748b;">${s.additional_note}</td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      };

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 1200px;">
                  
                  <tr>
                    <td style="background-color: #0f172a; padding: 30px; text-align: center;">
                      <div style="background-color: rgba(255,255,255,0.1); width: 48px; height: 48px; border-radius: 50%; display: inline-block; line-height: 48px; margin-bottom: 15px;">
                        <span style="color: #ffffff; font-size: 24px; font-weight: bold;">Q</span>
                      </div>
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Upcoming Solicitations</h1>
                      <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 15px;">Hi <strong>${user_name}</strong>, there are <strong>${solicitations.length}</strong> event(s) coming up soon.</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 20px; overflow-x: auto;">
                      ${renderGroup(grouped.today, 'Today')}
                      ${renderGroup(grouped.tomorrow, 'Tomorrow')}
                      ${renderGroup(grouped.upcoming, 'Upcoming in 5 Days')}
                    </td>
                  </tr>

                  <tr>
                    <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0; color: #64748b; font-size: 13px;">
                        You are receiving this because you opted into email reminders.
                      </p>
                      <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">
                        You can change your preferences in the Account Settings of the QSolicit app.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"QSolicit Notifications" <${GMAIL_ADDRESS}>`,
        to: `${user_name} <${user_email}>`,
        subject: `Reminder: ${solicitations.length} Upcoming Solicitations`,
        text: `You have ${solicitations.length} upcoming solicitations.`, // Fallback for plain text clients
        html: htmlContent,
      });
    }

    return new Response(JSON.stringify({ success: true, count: reminders.length }), {
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
