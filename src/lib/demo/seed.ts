// Fictional seed data for demo mode (`npm run dev:demo` / `npm run build:demo`).
// Everything here is made up. Dates are relative to "today" so the dashboard always looks alive.

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'

const iso = (offsetDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const ts = (offsetDays: number, hour = 9) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const TYPES = ['Invitation', 'Financial Assistance', 'Donation', 'Medical Mission', 'Sponsorship']
const STATUSES = ['Pending', 'For Review', 'Approved', 'Done', 'Discontinued']

const COLORS = [
  { label: 'Urgent', color: '#dc2626' },
  { label: 'Priority', color: '#f59e0b' },
  { label: 'Routine', color: '#2563eb' },
  { label: 'Courtesy', color: '#16a34a' },
]

const fc = (
  order: number,
  field_name: string,
  label: string,
  field_type: string,
  extra: Record<string, unknown> = {},
) => ({
  id: `fc-${field_name}`,
  field_name,
  label,
  field_type,
  options: [],
  is_required: false,
  validation_rule: null,
  default_value: null,
  color_mappings: null,
  display_order: order,
  created_at: ts(-90),
  updated_at: ts(-90),
  ...extra,
})

const fieldConfigs = [
  fc(1, 'type', 'Type', 'select', { options: TYPES, is_required: true }),
  fc(2, 'control_number', 'Control No.', 'text', { is_required: true, color_mappings: COLORS }),
  fc(3, 'date_received', 'Date Received', 'date', { is_required: true }),
  fc(4, 'organization_name', 'Organization', 'text', { is_required: true }),
  fc(5, 'sub_area', 'Sub-area', 'text'),
  fc(6, 'event', 'Event', 'text', { is_required: true }),
  fc(7, 'event_date', 'Event Date', 'date', { is_required: true }),
  fc(8, 'event_time', 'Event Time', 'time'),
  fc(9, 'request', 'Request', 'textarea'),
  fc(10, 'venue', 'Venue', 'text'),
  fc(11, 'contact_person', 'Contact Person', 'text'),
  fc(12, 'contact_number', 'Contact Number', 'text'),
  fc(13, 'status', 'Status', 'select', { options: STATUSES, is_required: true, default_value: 'Pending' }),
  fc(14, 'recom', 'Recommendation', 'textarea'),
  fc(15, 'remarks', 'Remarks', 'textarea'),
  fc(16, 'voters_turnout', 'Voters Turnout', 'text'),
  fc(17, 'additional_note', 'Additional Note', 'textarea'),
  // Sentinel app-setting row (see fieldConfigs.ts)
  fc(999, 'enable_excel_download', 'Enable Excel Download', 'text', { is_required: true }),
]

type Row = [
  type: string,
  org: string,
  area: string,
  event: string,
  eventOffset: number,
  receivedOffset: number,
  status: string,
  request: string,
  venue: string,
  person: string,
  color: string | null,
]

const rows: Row[] = [
  ['Invitation', 'Bright Futures Youth Alliance', 'Riverside', 'Annual Youth Leadership Summit', 3, -12, 'Approved', 'Request for a guest speaker to deliver the opening remarks.', 'Riverside Community Hall', 'Maria Santos', 'Priority'],
  ['Financial Assistance', 'Greenfield Senior Citizens Association', 'Greenfield', 'Senior Wellness Day', 5, -10, 'For Review', 'Financial support for medical check-ups and refreshments.', 'Greenfield Barangay Gym', 'Jose Ramirez', 'Urgent'],
  ['Donation', 'Harbor Light Foundation', 'Harborview', 'Coastal Clean-up Drive', 8, -9, 'Pending', 'Donation of 200 trash bags and gloves for volunteers.', 'Harborview Shoreline', 'Ana Dela Cruz', 'Routine'],
  ['Medical Mission', 'Sunrise Health Volunteers', 'Sunrise Heights', 'Free Medical and Dental Mission', 12, -8, 'Approved', 'Logistics support and 3 volunteers for registration.', 'Sunrise Elementary School', 'Dr. Paolo Reyes', 'Priority'],
  ['Sponsorship', 'Eastside Basketball League', 'Eastside', 'Inter-Zone Basketball Tournament', 15, -7, 'Pending', 'Sponsorship for trophies and referee fees.', 'Eastside Covered Court', 'Rico Mendoza', 'Routine'],
  ['Invitation', 'Lakeshore Parents Association', 'Lakeshore', 'Family Day Celebration', 1, -14, 'Approved', 'Invitation to attend and say a few words.', 'Lakeshore Park', 'Liza Navarro', 'Courtesy'],
  ['Financial Assistance', 'Hillcrest Fire Victims Committee', 'Hillcrest', 'Relief Distribution for Fire Victims', 2, -4, 'For Review', 'Assistance for 25 affected families.', 'Hillcrest Chapel', 'Elena Bautista', 'Urgent'],
  ['Donation', 'Maple Street Learning Center', 'Maple Street', 'Back-to-School Drive', 20, -6, 'Pending', 'School supplies for 120 pupils.', 'Maple Street Learning Center', 'Teresa Lim', 'Routine'],
  ['Sponsorship', 'Northgate Cultural Society', 'Northgate', 'Heritage Festival 2026', 28, -5, 'For Review', 'Sponsorship for sound system rental and stage.', 'Northgate Plaza', 'Benjie Aquino', 'Priority'],
  ['Invitation', 'Cedar Valley Farmers Cooperative', 'Cedar Valley', 'Harvest Thanksgiving Program', 10, -3, 'Pending', 'Guest of honor for the thanksgiving program.', 'Cedar Valley Multi-purpose Hall', 'Nestor Villanueva', 'Courtesy'],
  ['Medical Mission', 'Pinewood Women’s Circle', 'Pinewood', 'Women’s Health Awareness Seminar', 6, -2, 'Approved', 'Venue sponsorship and snacks for 80 attendees.', 'Pinewood Barangay Hall', 'Corazon Diaz', 'Routine'],
  ['Donation', 'Stonebridge Youth Choir', 'Stonebridge', 'Christmas Caroling Fundraiser', 45, -1, 'Pending', 'Donation of instruments and uniforms.', 'Stonebridge Church', 'Marco Tan', 'Routine'],
  ['Invitation', 'Westend Tricycle Operators Association', 'Westend', 'General Assembly', 4, -11, 'For Review', 'Invitation to the general assembly and induction of officers.', 'Westend Terminal', 'Ruben Castillo', 'Courtesy'],
  ['Sponsorship', 'Brookside Fun Run Committee', 'Brookside', 'Brookside 5K Fun Run', 18, -15, 'Approved', 'Sponsorship for race kits and medals.', 'Brookside Park', 'Katrina Flores', 'Priority'],
  ['Financial Assistance', 'Oakdale Scholars Fund', 'Oakdale', 'Scholarship Awarding Ceremony', 22, -13, 'Pending', 'Financial support for 10 scholarship grants.', 'Oakdale Auditorium', 'Helen Ocampo', 'Priority'],
  // History (Done / Discontinued)
  ['Invitation', 'Bayview Fishermen’s Association', 'Bayview', 'Fisherfolk Appreciation Day', -7, -30, 'Done', 'Guest speaker for the program.', 'Bayview Wharf', 'Arman Soriano', 'Courtesy'],
  ['Donation', 'Silver Oaks Elderly Home', 'Silver Oaks', 'Christmas Gift-Giving', -14, -40, 'Done', 'Gift packs for 60 residents.', 'Silver Oaks Elderly Home', 'Sister Agnes', 'Routine'],
  ['Sponsorship', 'Redwood Dance Troupe', 'Redwood', 'Regional Dance Competition', -21, -45, 'Done', 'Sponsorship for costumes and transport.', 'Redwood Arena', 'Joanna Pascual', 'Priority'],
  ['Medical Mission', 'Meadowlands Health Center', 'Meadowlands', 'Free Vaccination Drive', -30, -55, 'Done', 'Tents, tables and volunteer marshals.', 'Meadowlands Plaza', 'Dr. Lorna Vega', 'Urgent'],
  ['Financial Assistance', 'Crestview Livelihood Group', 'Crestview', 'Livelihood Training Program', -18, -35, 'Discontinued', 'Seed funding for a livelihood project. Group disbanded.', 'Crestview Barangay Hall', 'Dante Gomez', 'Routine'],
  ['Invitation', 'Valley Ridge Homeowners', 'Valley Ridge', 'Neighborhood Fiesta', -25, -42, 'Discontinued', 'Invitation withdrawn by the organizer.', 'Valley Ridge Clubhouse', 'Irene Padilla', 'Courtesy'],
  ['Donation', 'Southpoint Scouts', 'Southpoint', 'Scout Jamboree', -40, -60, 'Done', 'Camping equipment donation.', 'Southpoint Campsite', 'Gilbert Ramos', 'Routine'],
  ['Sponsorship', 'Elm Grove Chess Club', 'Elm Grove', 'Open Chess Tournament', -9, -28, 'Done', 'Prize money and venue fee.', 'Elm Grove Library', 'Victor Salazar', 'Routine'],
]

const solicitations = rows.map(
  ([type, org, area, event, eventOffset, receivedOffset, status, request, venue, person, color], i) => ({
    id: `00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`,
    type,
    control_number: `2026-${String(i + 1).padStart(4, '0')}`,
    date_received: iso(receivedOffset),
    organization_name: org,
    sub_area: area,
    event,
    event_date: iso(eventOffset),
    event_time: ['08:00', '09:30', '13:00', '15:00', '17:30'][i % 5],
    request,
    venue,
    contact_person: person,
    contact_number: `0917-555-${String(1000 + i * 37).slice(-4)}`,
    status,
    recom: status === 'Approved' ? 'Recommended for approval.' : null,
    remarks: null,
    voters_turnout: null,
    additional_note: null,
    control_number_color: color,
    attachments: null,
    created_by: DEMO_USER_ID,
    created_at: ts(receivedOffset, 8 + (i % 8)),
    updated_at: ts(receivedOffset, 8 + (i % 8)),
  }),
)

export function createSeed(): Record<string, Record<string, unknown>[]> {
  return {
    solicitations,
    field_configs: fieldConfigs,
    profiles: [{ id: DEMO_USER_ID, email: 'demo@eventdesk.app', role: 'superadmin' }],
    user_settings: [{ user_id: DEMO_USER_ID, receive_notifications: true, updated_at: ts(-1) }],
    app_settings: [{ key: 'telegram_chat_id', value: '-1001234567890', updated_at: ts(-1) }],
  }
}
