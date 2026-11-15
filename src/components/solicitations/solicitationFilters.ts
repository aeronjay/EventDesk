import type { DateFilterField } from '@/lib/solicitations'

// ── Filter state ──

export interface SolicitationFilters {
  includeHistory: boolean // Solicits tab only: also show Done / Discontinued
  types: string[]
  statuses: string[]
  colors: string[]
  dateField: DateFilterField
  dateFrom: string
  dateTo: string
}

export const EMPTY_FILTERS: SolicitationFilters = {
  includeHistory: false,
  types: [],
  statuses: [],
  colors: [],
  dateField: 'event',
  dateFrom: '',
  dateTo: '',
}

export const DEFAULT_SORT = 'event_asc'

export const hasDateFilter = (f: SolicitationFilters) => f.dateFrom !== '' || f.dateTo !== ''

export const countActiveFilters = (f: SolicitationFilters) =>
  (f.includeHistory ? 1 : 0) +
  (f.types.length ? 1 : 0) + (f.statuses.length ? 1 : 0) + (f.colors.length ? 1 : 0) + (hasDateFilter(f) ? 1 : 0)
