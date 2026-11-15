import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchDashboardCounts,
  fetchDashboardEvents,
  fetchRecentActive,
  fetchSolicitations,
  fetchControlNumberColorCounts,
  type Solicitation,
  type ColorCounts,
} from '@/lib/solicitations'
import { getExcelDownloadSetting, fetchFieldConfigs, type ColorMapping } from '@/lib/fieldConfigs'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Plus, Download, ArrowUpRight, CalendarDays, Inbox } from 'lucide-react'
import { toast } from 'sonner'

const AGENDA_DAYS = 7 // today + the next 6 days

// ── Date helpers (local time, not UTC) ──

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Parse a 'YYYY-MM-DD…' value as a local calendar date
const parseDateKey = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

const formatEventTime = (time?: string | null) => {
  if (!time) return null
  const match = time.match(/(\d{1,2}):(\d{2})/)
  if (!match) return time
  let hours = parseInt(match[1], 10)
  const mins = match[2]
  const ampmMatch = time.match(/(AM|PM)/i)
  const ampm = ampmMatch ? ampmMatch[1].toUpperCase() : hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${mins} ${ampm}`
}

// Minutes since midnight, for sorting events within a day (untimed events last)
const timeSortValue = (time?: string | null) => {
  const label = formatEventTime(time)
  const match = label?.match(/(\d{1,2}):(\d{2}) (AM|PM)/)
  if (!match) return Number.MAX_SAFE_INTEGER
  const h = (parseInt(match[1], 10) % 12) + (match[3] === 'PM' ? 12 : 0)
  return h * 60 + parseInt(match[2], 10)
}

const greeting = (hour: number) =>
  hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

const dayLabel = (date: Date, today: Date) => {
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

const relativeDay = (value?: string | null) => {
  if (!value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - parseDateKey(value).getTime()) / 86_400_000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  return parseDateKey(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface AgendaDay {
  key: string
  date: Date
  events: Solicitation[]
}

export default function DashboardOverview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeCount, setActiveCount] = useState(0)
  const [events, setEvents] = useState<Solicitation[]>([])
  const [recentActive, setRecentActive] = useState<Solicitation[]>([])
  const [loading, setLoading] = useState(true)
  const [excelEnabled, setExcelEnabled] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [colorMappings, setColorMappings] = useState<ColorMapping[]>([])
  const [colorCounts, setColorCounts] = useState<ColorCounts | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const end = new Date(today)
        end.setDate(today.getDate() + AGENDA_DAYS - 1)

        const [counts, upcoming, recent, excelSetting, configs] = await Promise.all([
          fetchDashboardCounts(),
          fetchDashboardEvents(toDateKey(today), toDateKey(end)),
          fetchRecentActive(6),
          getExcelDownloadSetting(),
          fetchFieldConfigs(),
        ])

        const mappings = configs.find((c) => c.field_name === 'control_number')?.color_mappings ?? []
        setColorMappings(mappings)
        setColorCounts(await fetchControlNumberColorCounts(mappings.map((m) => m.label)))

        setActiveCount(counts.active)
        setEvents(upcoming)
        setRecentActive(recent)
        setExcelEnabled(excelSetting)
      } catch (err) {
        console.error(err)
        toast.error('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [today])

  // Group events by day; only days that have events are shown
  const agenda = useMemo<AgendaDay[]>(() => {
    const byDay = new Map<string, AgendaDay>()
    for (const s of events) {
      if (!s.event_date) continue
      const key = s.event_date.slice(0, 10)
      if (!byDay.has(key)) byDay.set(key, { key, date: parseDateKey(key), events: [] })
      byDay.get(key)!.events.push(s)
    }
    const days = [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key))
    days.forEach((d) => d.events.sort((a, b) => timeSortValue(a.event_time) - timeSortValue(b.event_time)))
    return days
  }, [events])

  const todayCount = agenda.find((d) => d.key === toDateKey(today))?.events.length ?? 0

  const exportToExcelData = async () => {
    try {
      setExporting(true)
      const solicitations = await fetchSolicitations()
      if (solicitations.length === 0) {
        toast.error('No data to export')
        return
      }
      const { exportToExcel } = await import('@/lib/exportToExcel')
      await exportToExcel(solicitations)
      toast.success('Exported to Excel')
    } catch (err: any) {
      console.error('Export Error:', err)
      toast.error(`Failed to export Excel: ${err.message || 'Unknown error'}`)
    } finally {
      setExporting(false)
    }
  }

  const openSolicitation = (id: string) => navigate(`/solicits?id=${id}`)
  const firstName = user?.email?.split('@')[0]?.split(/[._-]/)[0]
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : null

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
        {/* ── Header ── */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {greeting(new Date().getHours())}
              {displayName && <span className="text-muted-foreground">, {displayName}</span>}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {excelEnabled && (
              <Button variant="ghost" onClick={exportToExcelData} disabled={exporting} className="gap-2 text-muted-foreground">
                <Download size={16} />
                {exporting ? 'Exporting…' : 'Export'}
              </Button>
            )}
            <Button onClick={() => navigate('/solicits?new=1')} className="gap-2 rounded-full px-5 shadow-[0_8px_24px_-8px] shadow-primary/60">
              <Plus size={16} />
              New Solicitation
            </Button>
          </div>
        </header>

        {/* ── Key numbers ── */}
        <section className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card">
          <Stat label="Active" value={activeCount} onClick={() => navigate('/solicits')} accent />
          <Stat label="Events today" value={todayCount} />
          <Stat label="Next 7 days" value={events.length} />
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* ── Agenda ── */}
          <section className="lg:col-span-3">
            <SectionHeading title="This week" />
            {agenda.length === 0 ? (
              <EmptyState icon={CalendarDays} text="No events in the next 7 days." />
            ) : (
              <div className="space-y-6">
                {agenda.map((day) => (
                  <div key={day.key}>
                    <div className="mb-2 flex items-baseline gap-2 px-1">
                      <h4 className={`text-sm font-semibold ${day.key === toDateKey(today) ? 'text-primary' : 'text-foreground'}`}>
                        {dayLabel(day.date, today)}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <ul className="overflow-hidden rounded-2xl border border-border bg-card">
                      {day.events.map((s) => (
                        <li key={s.id} className="border-b border-border/70 last:border-b-0">
                          <button
                            onClick={() => openSolicitation(s.id)}
                            className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/60"
                          >
                            <span className="w-16 shrink-0 text-sm tabular-nums text-muted-foreground">
                              {formatEventTime(s.event_time) ?? 'All day'}
                            </span>
                            <span className="h-8 w-px shrink-0 bg-border" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {s.event || 'Untitled event'}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {s.organization_name || 'No organization'}
                              </span>
                            </span>
                            <ArrowUpRight
                              size={16}
                              className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-8 lg:col-span-2">
          {/* ── Control number colors ── */}
          {colorCounts && colorMappings.length > 0 && (
            <ColorBreakdown mappings={colorMappings} counts={colorCounts} />
          )}

          {/* ── Recently added ── */}
          <section>
            <SectionHeading title="Recently added" action={{ label: 'View all', onClick: () => navigate('/solicits') }} />
            {recentActive.length === 0 ? (
              <EmptyState icon={Inbox} text="No active solicitations." />
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-border bg-card">
                {recentActive.map((s) => (
                  <li key={s.id} className="border-b border-border/70 last:border-b-0">
                    <button
                      onClick={() => openSolicitation(s.id)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                        {(s.organization_name || '?').trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {s.organization_name || 'Unnamed organization'}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {s.event || 'No event'}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {relativeDay(s.date_received)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>
        </div>
      </div>
    </div>
  )
}

const NO_COLOR = 'No color'
const OTHER = 'Other'

function ColorBreakdown({ mappings, counts }: { mappings: ColorMapping[]; counts: ColorCounts }) {
  const [hovered, setHovered] = useState<string | null>(null)

  // Fixed order: the admin-configured mappings, then Other, then No color
  const rows = [
    ...mappings.map((m) => ({ label: m.label, color: m.color, count: counts.byLabel[m.label] ?? 0 })),
    ...(counts.other > 0 ? [{ label: OTHER, color: 'var(--muted-foreground)', count: counts.other }] : []),
    { label: NO_COLOR, color: 'var(--border)', count: counts.none },
  ]
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0)

  return (
    <section>
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">
          Across all {counts.total} solicitations
        </p>

        {/* Part-to-whole bar */}
        {counts.total > 0 && (
          <div className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {rows
              .filter((r) => r.count > 0)
              .map((r) => (
                <div
                  key={r.label}
                  title={`${r.label}: ${r.count} (${pct(r.count)}%)`}
                  onMouseEnter={() => setHovered(r.label)}
                  onMouseLeave={() => setHovered(null)}
                  className="h-full transition-opacity"
                  style={{
                    flexGrow: r.count,
                    backgroundColor: r.color,
                    opacity: hovered && hovered !== r.label ? 0.3 : 1,
                  }}
                />
              ))}
          </div>
        )}

        {/* Legend with counts */}
        <ul className="mt-4 space-y-1">
          {rows.map((r) => (
            <li
              key={r.label}
              onMouseEnter={() => setHovered(r.label)}
              onMouseLeave={() => setHovered(null)}
              className={`-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                hovered === r.label ? 'bg-secondary/60' : ''
              }`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.label === NO_COLOR ? 'border border-muted-foreground/40' : ''}`}
                style={{ backgroundColor: r.label === NO_COLOR ? 'transparent' : r.color }}
              />
              <span className={`flex-1 truncate ${r.label === NO_COLOR || r.label === OTHER ? 'text-muted-foreground' : 'text-foreground'}`}>
                {r.label}
              </span>
              <span className="font-medium tabular-nums text-foreground">{r.count}</span>
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{pct(r.count)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Stat({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`border-r border-border px-4 py-5 text-left last:border-r-0 sm:px-6 sm:py-6 ${onClick ? 'transition-colors hover:bg-secondary/60' : ''}`}
    >
      <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
    </Comp>
  )
}

function SectionHeading({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-4 flex items-center justify-between px-1">
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      {action && (
        <button onClick={action.onClick} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          {action.label} →
        </button>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <Icon size={20} className="text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
