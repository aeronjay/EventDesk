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

// ── Dashboard: how many solicitations (active + history) carry each control number color ──
export interface ColorCounts {
  byLabel: Record<string, number> // keyed by color_mappings label
  other: number // a color value that no longer matches any mapping
  none: number // no color set
  total: number
}

export async function fetchControlNumberColorCounts(labels: string[]): Promise<ColorCounts> {
  const head = () => supabase.from('solicitations').select('*', { count: 'exact', head: true })

  const [totalRes, coloredRes, ...labelRes] = await Promise.all([
    head(),
    head().not('control_number_color', 'is', null).neq('control_number_color', ''),
    ...labels.map((label) => head().eq('control_number_color', label)),
  ])

  for (const res of [totalRes, coloredRes, ...labelRes]) {
    if (res.error) throw res.error
  }

  const byLabel: Record<string, number> = {}
  labels.forEach((label, i) => (byLabel[label] = labelRes[i].count ?? 0))

  const total = totalRes.count ?? 0
  const colored = coloredRes.count ?? 0
  const matched = Object.values(byLabel).reduce((a, b) => a + b, 0)

  return { byLabel, other: Math.max(0, colored - matched), none: total - colored, total }
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

// Sentinel used in a color filter to match solicitations with no control number color
export const NO_COLOR_FILTER = '__none__'

export type DateFilterField = 'event' | 'received' | 'created'

export interface FetchPaginatedOptions {
  page: number
  pageSize: number
  showHistory: boolean
  includeHistory?: boolean // ignore the active/history split and search everything
  search?: string
  types?: string[]
  statuses?: string[]
  colors?: string[] // color_mappings labels, and/or NO_COLOR_FILTER
  sortBy?: string
  dateField?: DateFilterField
  dateFrom?: string // YYYY-MM-DD, inclusive
  dateTo?: string // YYYY-MM-DD, inclusive
}

// Quote a value for use inside a PostgREST `in.(...)` list
const quoteFilterValue = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

// Start of a local calendar day as an ISO timestamp (for timestamptz columns)
const localDayStartISO = (dateKey: string, addDays = 0) => {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d + addDays).toISOString()
}

export type SolicitationQueryOptions = Omit<FetchPaginatedOptions, 'page' | 'pageSize'>

const sortSpec = (sortBy = 'event_asc') => {
  let column = 'event_date'
  if (sortBy.startsWith('received')) column = 'date_received'
  else if (sortBy.startsWith('created')) column = 'created_at'
  return { column, ascending: sortBy.endsWith('_asc') }
}

// Base query with the tab scope, filters and search applied (no sort or range)
function buildFilteredQuery(opts: SolicitationQueryOptions, isCount: boolean) {
  const { showHistory, includeHistory, search, types, statuses, colors, dateField, dateFrom, dateTo } = opts

  let q = isCount
    ? supabase.from('solicitations').select('*', { count: 'exact', head: true })
    : supabase.from('solicitations').select('*')

  // History vs Active filter
  if (includeHistory) {
    // all solicitations
  } else if (showHistory) {
    q = q.in('status', ['Done', 'Discontinued'])
  } else {
    q = q.not('status', 'in', '("Done","Discontinued")')
  }

  if (types?.length) q = q.in('type', types)
  if (statuses?.length) q = q.in('status', statuses)

  if (colors?.length) {
    const labels = colors.filter((c) => c !== NO_COLOR_FILTER)
    const parts: string[] = []
    if (labels.length) parts.push(`control_number_color.in.(${labels.map(quoteFilterValue).join(',')})`)
    if (colors.includes(NO_COLOR_FILTER)) parts.push('control_number_color.is.null', 'control_number_color.eq.')
    q = q.or(parts.join(','))
  }

  // Date range on one of the date columns
  if (dateField === 'created') {
    // created_at is a timestamp: compare against local day boundaries
    if (dateFrom) q = q.gte('created_at', localDayStartISO(dateFrom))
    if (dateTo) q = q.lt('created_at', localDayStartISO(dateTo, 1))
  } else if (dateField) {
    const column = dateField === 'event' ? 'event_date' : 'date_received'
    if (dateFrom) q = q.gte(column, dateFrom)
    if (dateTo) q = q.lte(column, dateTo)
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

export async function fetchPaginatedSolicitations(opts: FetchPaginatedOptions): Promise<PaginatedResult> {
  const { page, pageSize } = opts
  const { column, ascending } = sortSpec(opts.sortBy)

  // Run count + data queries in parallel
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const [countResult, dataResult] = await Promise.all([
    buildFilteredQuery(opts, true),
    buildFilteredQuery(opts, false)
      .order(column, { ascending, nullsFirst: false })
      .order('id', { ascending: true }) // tie-breaker so rows with equal dates keep a stable page
      .range(from, to),
  ])

  if (countResult.error) throw countResult.error
  if (dataResult.error) throw dataResult.error

  return {
    data: (dataResult.data ?? []) as Solicitation[],
    totalCount: countResult.count ?? 0,
  }
}

// Which page a solicitation lands on for the given filters and sort,
// or null when the filters exclude it. Mirrors the ordering in fetchPaginatedSolicitations.
export async function findSolicitationPage(
  record: Solicitation,
  opts: SolicitationQueryOptions,
  pageSize: number
): Promise<number | null> {
  const matchRes = await buildFilteredQuery(opts, true).eq('id', record.id)
  if (matchRes.error) throw matchRes.error
  if (!matchRes.count) return null

  const { column, ascending } = sortSpec(opts.sortBy)
  const value = record[column as keyof Solicitation] as string | null
  const id = quoteFilterValue(record.id)

  // Rows ordered before this one: earlier sort value, or same value and a lower id.
  // Nulls sort last, so a non-null value is never preceded by a null.
  const before = value == null
    ? `${column}.not.is.null,and(${column}.is.null,id.lt.${id})`
    : `${column}.${ascending ? 'lt' : 'gt'}.${quoteFilterValue(value)},and(${column}.eq.${quoteFilterValue(value)},id.lt.${id})`

  const beforeRes = await buildFilteredQuery(opts, true).or(before)
  if (beforeRes.error) throw beforeRes.error

  return Math.floor((beforeRes.count ?? 0) / pageSize) + 1
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
