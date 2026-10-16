import { supabase } from './supabaseClient'

export interface Solicitation {
  id: string
  type: string | null
  control_number: string | null
  date_received: string | null
  organization_name: string | null
  sub_area: string | null
  event: string | null
  event_date: string | null
  event_time: string | null
  request: string | null
  venue: string | null
  contact_person: string | null
  contact_number: string | null
  status: string | null
  recom: string | null
  remarks: string | null
  voters_turnout: string | null
  additional_note: string | null
  control_number_color: string | null
  attachments: { name: string, url: string, key: string }[] | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SolicitationInsert = Omit<Solicitation, 'id' | 'created_at' | 'updated_at'>

// ── Legacy: fetch ALL solicitations (only used by CSV export now) ──
export async function fetchSolicitations() {
  let allData: Solicitation[] = []
  let from = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase
      .from('solicitations')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    if (error) throw error

    if (data && data.length > 0) {
      allData = [...allData, ...(data as Solicitation[])]
    }

    if (!data || data.length < limit) {
      break
    }

    from += limit
  }

  return allData
}

// ── Dashboard: counts only (no row data transferred) ──
export interface DashboardCounts {
  total: number
  active: number
  completed: number
  discontinued: number
}

export async function fetchDashboardCounts(): Promise<DashboardCounts> {
  // Run all count queries in parallel — each returns just a number
  const [totalRes, completedRes, discontinuedRes] = await Promise.all([
    supabase.from('solicitations').select('*', { count: 'exact', head: true }),
    supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'Done'),
    supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'Discontinued'),
  ])

  if (totalRes.error) throw totalRes.error
  if (completedRes.error) throw completedRes.error
  if (discontinuedRes.error) throw discontinuedRes.error

  const total = totalRes.count ?? 0
  const completed = completedRes.count ?? 0
  const discontinued = discontinuedRes.count ?? 0
  const active = total - completed - discontinued

  return { total, active, completed, discontinued }
}

// ── Dashboard: events within a date window (today ± days) ──
// Only fetches the columns needed for the dashboard cards
const DASHBOARD_EVENT_COLUMNS = 'id,type,control_number,organization_name,event,event_date,event_time,request,status,date_received,contact_person' as const

export async function fetchDashboardEvents(fromDate: string, toDate: string): Promise<Solicitation[]> {
  const { data, error } = await supabase
    .from('solicitations')
    .select(DASHBOARD_EVENT_COLUMNS)
    .not('status', 'in', '("Done","Discontinued")')
    .not('event_date', 'is', null)
    .gte('event_date', fromDate)
    .lte('event_date', toDate)
    .order('event_date', { ascending: true })

  if (error) throw error
  return data as Solicitation[]
}

// ── Dashboard: recent active solicitations (limited) ──
export async function fetchRecentActive(limit: number = 5): Promise<Solicitation[]> {
  const { data, error } = await supabase
    .from('solicitations')
    .select(DASHBOARD_EVENT_COLUMNS)
    .not('status', 'in', '("Done","Discontinued")')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as Solicitation[]
}

// ── Paginated fetch for Solicitations / History tabs ──
export interface PaginatedResult {
  data: Solicitation[]
  totalCount: number
}

export interface FetchPaginatedOptions {
  page: number
  pageSize: number
  showHistory: boolean
  search?: string
  filterType?: string
  filterStatus?: string
  sortBy?: string
  eventDateFrom?: string
  eventDateTo?: string
  receivedDateFrom?: string
  receivedDateTo?: string
  createdDateFrom?: string
  createdDateTo?: string
}

export async function fetchPaginatedSolicitations(opts: FetchPaginatedOptions): Promise<PaginatedResult> {
  const {
    page,
    pageSize,
    showHistory,
    search,
    filterType,
    filterStatus,
    sortBy = 'event_asc',
    eventDateFrom,
    eventDateTo,
    receivedDateFrom,
    receivedDateTo,
    createdDateFrom,
    createdDateTo,
  } = opts

  // Determine sort column and direction
  let sortColumn = 'event_date'
  let ascending = true
  if (sortBy.startsWith('received')) {
    sortColumn = 'date_received'
  } else if (sortBy.startsWith('created')) {
    sortColumn = 'created_at'
  }
  ascending = sortBy.endsWith('_asc')

  // ── Build the base query for count ──
  const buildQuery = (isCount: boolean) => {
    let q = isCount
      ? supabase.from('solicitations').select('*', { count: 'exact', head: true })
      : supabase.from('solicitations').select('*')

    // History vs Active filter
    if (showHistory) {
      q = q.in('status', ['Done', 'Discontinued'])
    } else {
      q = q.not('status', 'in', '("Done","Discontinued")')
    }

    // Type filter
    if (filterType && filterType !== 'all') {
      q = q.eq('type', filterType)
    }

    // Status filter
    if (filterStatus && filterStatus !== 'all') {
      q = q.eq('status', filterStatus)
    }

    // Date range filters (only one category active at a time, same as current UI logic)
    if (eventDateFrom) {
      q = q.gte('event_date', eventDateFrom)
    }
    if (eventDateTo) {
      q = q.lte('event_date', eventDateTo)
    }
    if (receivedDateFrom) {
      q = q.gte('date_received', receivedDateFrom)
    }
    if (receivedDateTo) {
      q = q.lte('date_received', receivedDateTo)
    }
    if (createdDateFrom) {
      q = q.gte('created_at', createdDateFrom)
    }
    if (createdDateTo) {
      // Add end-of-day for created_at since it's a timestamp
      q = q.lte('created_at', createdDateTo + 'T23:59:59.999Z')
    }

    // Search filter — use OR across multiple columns
    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      q = q.or(
        `organization_name.ilike.${term},control_number.ilike.${term},event.ilike.${term},contact_person.ilike.${term},venue.ilike.${term}`
      )
    }

    return q
  }

  // Run count + data queries in parallel
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const [countResult, dataResult] = await Promise.all([
    buildQuery(true),
    buildQuery(false)
      .order(sortColumn, { ascending, nullsFirst: false })
      .range(from, to),
  ])

  if (countResult.error) throw countResult.error
  if (dataResult.error) throw dataResult.error

  return {
    data: (dataResult.data ?? []) as Solicitation[],
    totalCount: countResult.count ?? 0,
  }
}

// ── Single record ──
export async function fetchSolicitation(id: string) {
  const { data, error } = await supabase
    .from('solicitations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Solicitation
}

// ── CRUD ──
export async function createSolicitation(record: Partial<SolicitationInsert>) {
  const { data, error } = await supabase
    .from('solicitations')
    .insert(record)
    .select()
    .single()

  if (error) throw error
  return data as Solicitation
}

export async function updateSolicitation(id: string, updates: Partial<SolicitationInsert>) {
  const { data, error } = await supabase
    .from('solicitations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Solicitation
}

export async function deleteSolicitation(id: string) {
  const { data, error } = await supabase
    .from('solicitations')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) throw error
  // RLS silently filters out rows the user can't delete, so 0 rows means it was blocked
  if (!data || data.length === 0) {
    throw new Error('Solicitation was not deleted (not found or not permitted)')
  }
}
