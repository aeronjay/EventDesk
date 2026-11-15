import { useState } from 'react'
import { NO_COLOR_FILTER, type DateFilterField } from '@/lib/solicitations'
import { hasDateFilter, type SolicitationFilters } from './solicitationFilters'
import type { ColorMapping } from '@/lib/fieldConfigs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { ArrowDownUp, Check, ChevronDown, Plus, X } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'event_asc', label: 'Event date', hint: 'Soonest first' },
  { value: 'event_desc', label: 'Event date', hint: 'Latest first' },
  { value: 'received_desc', label: 'Date received', hint: 'Newest first' },
  { value: 'received_asc', label: 'Date received', hint: 'Oldest first' },
  { value: 'created_desc', label: 'Date added', hint: 'Newest first' },
  { value: 'created_asc', label: 'Date added', hint: 'Oldest first' },
]

const DATE_FIELDS: { value: DateFilterField; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'received', label: 'Received' },
  { value: 'created', label: 'Added' },
]

const DATE_FIELD_NAMES: Record<DateFilterField, string> = {
  event: 'Event date',
  received: 'Received',
  created: 'Added',
}

// ── Date helpers (local calendar days) ──

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const formatKey = (key: string) =>
  fromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface DatePreset {
  label: string
  range: () => [string, string]
}

const offset = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toKey(d)
}

const monthRange = (monthOffset: number): [string, string] => {
  const now = new Date()
  return [
    toKey(new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)),
    toKey(new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0)),
  ]
}

// Events are mostly looked up ahead; received/added dates are looked up back
const PRESETS: Record<DateFilterField, DatePreset[]> = {
  event: [
    { label: 'Today', range: () => [offset(0), offset(0)] },
    { label: 'Next 7 days', range: () => [offset(0), offset(6)] },
    { label: 'This month', range: () => monthRange(0) },
    { label: 'Next month', range: () => monthRange(1) },
  ],
  received: [
    { label: 'Today', range: () => [offset(0), offset(0)] },
    { label: 'Last 7 days', range: () => [offset(-6), offset(0)] },
    { label: 'This month', range: () => monthRange(0) },
    { label: 'Last month', range: () => monthRange(-1) },
  ],
  created: [],
}
PRESETS.created = PRESETS.received

const dateSummary = (f: SolicitationFilters) => {
  const preset = PRESETS[f.dateField].find((p) => {
    const [a, b] = p.range()
    return a === f.dateFrom && b === f.dateTo
  })
  if (preset) return preset.label
  if (f.dateFrom && f.dateTo) return f.dateFrom === f.dateTo ? formatKey(f.dateFrom) : `${formatKey(f.dateFrom)} – ${formatKey(f.dateTo)}`
  if (f.dateFrom) return `From ${formatKey(f.dateFrom)}`
  return `Until ${formatKey(f.dateTo)}`
}

// ── Building blocks ──

function FilterPill({
  label,
  summary,
  onClear,
  children,
  contentClassName = 'w-64',
}: {
  label: string
  summary: string | null // null = not filtering
  onClear: () => void
  children: React.ReactNode
  contentClassName?: string
}) {
  const active = summary !== null
  return (
    <div
      className={`inline-flex h-8 items-center rounded-full border text-sm transition-colors ${
        active
          ? 'border-primary/30 bg-primary/5 text-foreground'
          : 'border-dashed border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
      }`}
    >
      <Popover>
        <PopoverTrigger className={`flex h-full items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${active ? 'pl-3 pr-1.5' : 'px-3'}`}>
          {!active && <Plus size={14} />}
          <span className={active ? 'text-muted-foreground' : ''}>{label}</span>
          {active && (
            <>
              <span className="h-3.5 w-px bg-border" />
              <span className="max-w-[180px] truncate font-medium">{summary}</span>
            </>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className={`p-1.5 ${contentClassName}`}>
          {children}
        </PopoverContent>
      </Popover>
      {active && (
        <button
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          className="mr-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

interface Option {
  value: string
  label: string
  swatch?: string // CSS color; 'none' renders an empty ring
}

function MultiSelectList({
  options,
  selected,
  onChange,
  searchable,
}: {
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  searchable?: boolean
}) {
  const [query, setQuery] = useState('')
  const visible = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  return (
    <div className="flex flex-col">
      {searchable && (
        <Input
          autoFocus
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-1.5 h-8"
        />
      )}
      <div className="max-h-64 overflow-y-auto">
        {visible.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No options</p>}
        {visible.map((o) => {
          const checked = selected.includes(o.value)
          return (
            <button
              key={o.value}
              onClick={() => toggle(o.value)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                }`}
              >
                {checked && <Check size={12} strokeWidth={3} />}
              </span>
              {o.swatch && (
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${o.swatch === 'none' ? 'border border-muted-foreground/50' : ''}`}
                  style={o.swatch === 'none' ? undefined : { backgroundColor: o.swatch }}
                />
              )}
              <span className="truncate">{o.label}</span>
            </button>
          )
        })}
      </div>
      {selected.length > 0 && (
        <>
          <div className="my-1.5 h-px bg-border" />
          <button
            onClick={() => onChange([])}
            className="rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Clear selection
          </button>
        </>
      )}
    </div>
  )
}

const listSummary = (selected: string[], options: Option[]) => {
  if (selected.length === 0) return null
  if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label ?? selected[0]
  return `${selected.length} selected`
}

function DateFilter({ filters, onChange }: { filters: SolicitationFilters; onChange: (f: SolicitationFilters) => void }) {
  // true after the first click, while waiting for the end date
  const [pickingEnd, setPickingEnd] = useState(false)
  const set = (patch: Partial<SolicitationFilters>) => onChange({ ...filters, ...patch })

  const from = filters.dateFrom ? fromKey(filters.dateFrom) : undefined
  const to = filters.dateTo ? fromKey(filters.dateTo) : from

  // First click picks the start (and already filters that single day); second click picks the end
  const pickDay = (day: Date) => {
    const key = toKey(day)
    if (pickingEnd && filters.dateFrom) {
      const [start, end] = key < filters.dateFrom ? [key, filters.dateFrom] : [filters.dateFrom, key]
      set({ dateFrom: start, dateTo: end })
      setPickingEnd(false)
    } else {
      set({ dateFrom: key, dateTo: key })
      setPickingEnd(true)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-1.5">
      {/* Which date */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {DATE_FIELDS.map((f) => (
          <button
            key={f.value}
            onClick={() => set({ dateField: f.value })}
            className={`rounded-md py-1 text-xs font-medium transition-colors ${
              filters.dateField === f.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Quick picks */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS[filters.dateField].map((p) => {
          const [presetFrom, presetTo] = p.range()
          const selected = filters.dateFrom === presetFrom && filters.dateTo === presetTo
          return (
            <button
              key={p.label}
              onClick={() => {
                set({ dateFrom: presetFrom, dateTo: presetTo })
                setPickingEnd(false)
              }}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selected
                  ? 'border-primary/40 bg-primary/10 font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Calendar */}
      <div className="flex justify-center rounded-lg border border-border">
        <Calendar
          // remount when a preset jumps the range to another month
          key={filters.dateFrom.slice(0, 7)}
          mode="range"
          selected={from ? { from, to } : undefined}
          onSelect={(_, day) => pickDay(day)}
          defaultMonth={from ?? new Date()}
          className="[--cell-size:--spacing(8)]"
        />
      </div>

      {/* Status line */}
      <div className="flex min-h-5 items-center justify-between gap-2 px-0.5 text-xs">
        <span className="text-muted-foreground">
          {pickingEnd
            ? 'Now pick an end date, or keep this single day'
            : hasDateFilter(filters)
              ? dateSummary(filters)
              : 'Pick a start date'}
        </span>
        {hasDateFilter(filters) && (
          <button
            onClick={() => {
              set({ dateFrom: '', dateTo: '' })
              setPickingEnd(false)
            }}
            className="shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function SortMenu({ sortBy, onChange }: { sortBy: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = SORT_OPTIONS.find((o) => o.value === sortBy) ?? SORT_OPTIONS[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <ArrowDownUp size={14} />
        <span className="hidden sm:inline">
          {current.label} · <span className="text-foreground">{current.hint.toLowerCase()}</span>
        </span>
        <span className="sm:hidden">Sort</span>
        <ChevronDown size={14} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => {
              onChange(o.value)
              setOpen(false)
            }}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
          >
            <span>
              {o.label} <span className="text-muted-foreground">· {o.hint.toLowerCase()}</span>
            </span>
            {o.value === sortBy && <Check size={14} className="text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// ── The bar ──

export function SolicitationFilterBar({
  filters,
  onChange,
  sortBy,
  onSortChange,
  typeOptions,
  statusOptions,
  colorMappings,
  onClearAll,
  canClearAll,
  showScope,
}: {
  filters: SolicitationFilters
  onChange: (f: SolicitationFilters) => void
  sortBy: string
  onSortChange: (v: string) => void
  typeOptions: string[]
  statusOptions: string[]
  colorMappings: ColorMapping[]
  onClearAll: () => void
  canClearAll: boolean
  showScope?: boolean // Active / All switch (Solicits tab only)
}) {
  const set = (patch: Partial<SolicitationFilters>) => onChange({ ...filters, ...patch })

  const types: Option[] = typeOptions.map((t) => ({ value: t, label: t }))
  const statuses: Option[] = statusOptions.map((s) => ({ value: s, label: s }))
  const colors: Option[] = [
    ...colorMappings.map((m) => ({ value: m.label, label: m.label, swatch: m.color })),
    { value: NO_COLOR_FILTER, label: 'No color', swatch: 'none' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showScope && (
        <>
          <div className="inline-flex h-8 items-center rounded-full bg-muted p-0.5 text-sm" role="radiogroup" aria-label="Which solicitations">
            {[
              { value: false, label: 'Active', title: 'Only solicitations that are still open' },
              { value: true, label: 'All', title: 'Include Done and Discontinued solicitations' },
            ].map((o) => (
              <button
                key={o.label}
                role="radio"
                aria-checked={filters.includeHistory === o.value}
                title={o.title}
                // statuses differ between scopes, so a status filter is reset on switch
                onClick={() => filters.includeHistory !== o.value && set({ includeHistory: o.value, statuses: [] })}
                className={`h-full rounded-full px-3 font-medium transition-colors ${
                  filters.includeHistory === o.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="mx-1 h-5 w-px bg-border" />
        </>
      )}

      <FilterPill label="Type" summary={listSummary(filters.types, types)} onClear={() => set({ types: [] })}>
        <MultiSelectList options={types} selected={filters.types} onChange={(types) => set({ types })} searchable={types.length > 8} />
      </FilterPill>

      {statuses.length > 1 && (
        <FilterPill label="Status" summary={listSummary(filters.statuses, statuses)} onClear={() => set({ statuses: [] })}>
          <MultiSelectList options={statuses} selected={filters.statuses} onChange={(statuses) => set({ statuses })} />
        </FilterPill>
      )}

      {colorMappings.length > 0 && (
        <FilterPill label="Color" summary={listSummary(filters.colors, colors)} onClear={() => set({ colors: [] })}>
          <MultiSelectList options={colors} selected={filters.colors} onChange={(colors) => set({ colors })} />
        </FilterPill>
      )}

      <FilterPill
        label={hasDateFilter(filters) ? DATE_FIELD_NAMES[filters.dateField] : 'Date'}
        summary={hasDateFilter(filters) ? dateSummary(filters) : null}
        onClear={() => set({ dateFrom: '', dateTo: '' })}
        contentClassName="w-72"
      >
        <DateFilter filters={filters} onChange={onChange} />
      </FilterPill>

      {canClearAll && (
        <button onClick={onClearAll} className="px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          Clear all
        </button>
      )}

      <div className="ml-auto">
        <SortMenu sortBy={sortBy} onChange={onSortChange} />
      </div>
    </div>
  )
}
