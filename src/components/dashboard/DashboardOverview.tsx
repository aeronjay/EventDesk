import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchDashboardCounts,
  fetchDashboardEvents,
  fetchRecentActive,
  fetchSolicitations,
  type Solicitation,
  type DashboardCounts,
} from '@/lib/solicitations'
import { getExcelDownloadSetting } from '@/lib/fieldConfigs'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  Plus,
  Download,
  ArrowRight,
  TrendingUp,
  Calendar,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

const formatEventTime = (time?: string | null) => {
  if (!time) return null;
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return time;
  let hours = parseInt(match[1], 10);
  const mins = match[2];
  const ampmMatch = time.match(/(AM|PM)/i);
  let ampm = ampmMatch ? ampmMatch[1].toUpperCase() : (hours >= 12 ? 'PM' : 'AM');
  hours = hours % 12 || 12;
  return `${hours}:${mins} ${ampm}`;
};

export default function DashboardOverview() {
  const [metrics, setMetrics] = useState<DashboardCounts>({ total: 0, active: 0, completed: 0, discontinued: 0 })
  const [todaysEvents, setTodaysEvents] = useState<Solicitation[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Solicitation[]>([])
  const [recentActive, setRecentActive] = useState<Solicitation[]>([])
  const [loading, setLoading] = useState(true)
  const [excelEnabled, setExcelEnabled] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        // Compute date range: today → 6 days from now
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD

        const sixDaysLater = new Date(today)
        sixDaysLater.setDate(today.getDate() + 6)
        const sixDaysStr = sixDaysLater.toISOString().split('T')[0]

        const [counts, events, recent, excelSetting] = await Promise.all([
          fetchDashboardCounts(),
          fetchDashboardEvents(todayStr, sixDaysStr),
          fetchRecentActive(5),
          getExcelDownloadSetting(),
        ])

        setMetrics(counts)

        // Split events into today vs upcoming
        const todayStart = new Date(todayStr)
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date(todayStr)
        todayEnd.setHours(23, 59, 59, 999)

        const todays: Solicitation[] = []
        const upcoming: Solicitation[] = []

        events.forEach(s => {
          if (!s.event_date) return
          const d = new Date(s.event_date)
          if (d >= todayStart && d <= todayEnd) {
            todays.push(s)
          } else if (d > todayEnd) {
            upcoming.push(s)
          }
        })

        setTodaysEvents(todays)
        setUpcomingEvents(upcoming.slice(0, 5))
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
  }, [])

  const exportToExcelData = async () => {
    try {
      toast.info('Preparing export…')
      const solicitations = await fetchSolicitations()

      if (solicitations.length === 0) {
        toast.error('No data to export')
        return
      }

      const { exportToExcel } = await import('@/lib/exportToExcel')
      await exportToExcel(solicitations)
      
      toast.success('Exported to Excel successfully')
    } catch (err: any) {
      console.error('Export Error:', err)
      toast.error(`Failed to export Excel: ${err.message || 'Unknown error'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 p-6 overflow-hidden bg-background/50">
      <div className="mx-auto w-full max-w-7xl flex flex-col h-full gap-6">
        
        {/* Header Action Section */}
        <div className="flex shrink-0 items-center justify-end">
          <div className="flex items-center gap-3">
            {excelEnabled && (
              <Button variant="outline" onClick={exportToExcelData} className="gap-2 bg-background shadow-sm hover:bg-secondary/80">
                <Download size={16} />
                Export Excel
              </Button>
            )}
            <Button onClick={() => navigate('/solicits')} className="gap-2 shadow-md">
              <Plus size={16} />
              New Solicitation
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Solicits</p>
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <FileText size={16} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-foreground">{metrics.total}</h3>
            </div>
          </div>
          
          {/* Active */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between relative">
              <p className="text-sm font-medium text-muted-foreground">Active</p>
              <div className="rounded-full bg-blue-500/10 p-2 text-blue-500">
                <Activity size={16} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2 relative">
              <h3 className="text-3xl font-bold text-foreground">{metrics.active}</h3>
              {metrics.total > 0 && (
                <span className="text-xs text-muted-foreground font-medium flex items-center">
                  <TrendingUp size={12} className="mr-1 text-blue-500" />
                  {Math.round((metrics.active / metrics.total) * 100)}%
                </span>
              )}
            </div>
          </div>

          {/* Completed */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between relative">
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <div className="rounded-full bg-green-500/10 p-2 text-green-500">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2 relative">
              <h3 className="text-3xl font-bold text-foreground">{metrics.completed}</h3>
              {metrics.total > 0 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {Math.round((metrics.completed / metrics.total) * 100)}%
                </span>
              )}
            </div>
          </div>

          {/* Discontinued */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Discontinued</p>
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <XCircle size={16} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-foreground">{metrics.discontinued}</h3>
            </div>
          </div>
        </div>

        {/* Fixed Layout with Scrollable Cards */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
          
          <div className="flex flex-col gap-6 min-h-0">
            {/* Today's Events Section */}
            <div className="flex-1 rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-0">
              <div className="p-5 border-b border-border flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-orange-500/10 p-2 text-orange-500">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Today's Events</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Events scheduled for today.</p>
                  </div>
                </div>
              </div>
              <div className="p-0 overflow-y-auto flex-1 min-h-0">
                {todaysEvents.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center justify-center h-full">
                    <CheckCircle2 size={32} className="text-muted/50 mb-3" />
                    No events scheduled for today.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {todaysEvents.map((s) => (
                      <div 
                        key={s.id} 
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => navigate(`/solicits?id=${s.id}`)}
                      >
                        <div className="space-y-1 w-full">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-foreground">
                              {s.event || 'Unnamed Event'}
                            </h4>
                            <Badge variant="outline" className="shadow-sm whitespace-nowrap shrink-0">
                              {formatEventTime(s.event_time) || 'No Time'}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">{s.organization_name || 'No Org'}</span>
                            {s.control_number && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-primary/80">{s.control_number}</span>
                              </>
                            )}
                            {s.type && (
                              <>
                                <span>•</span>
                                <span>{s.type}</span>
                              </>
                            )}
                          </div>
                          
                          {s.request && (
                            <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1">
                              <span className="font-medium">Request:</span> {s.request}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Section */}
            <div className="flex-1 rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-0">
              <div className="p-5 border-b border-border flex items-center justify-between bg-card/50 shrink-0">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Recent Active Requests</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">The latest unresolved solicitations.</p>
                </div>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground" onClick={() => navigate('/solicits')}>
                  View All
                  <ArrowRight size={16} />
                </Button>
              </div>
              <div className="p-0 overflow-y-auto flex-1 min-h-0">
                {recentActive.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center justify-center h-full">
                    No active solicitations found.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentActive.map((s) => (
                      <div 
                        key={s.id} 
                        className="p-4 sm:p-5 flex flex-col gap-3 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => navigate(`/solicits?id=${s.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <FileText size={16} className="text-primary" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                                {s.organization_name || 'Unnamed Organization'}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="font-mono font-medium text-primary/80">{s.control_number || 'No Control No.'}</span>
                                {s.type && (
                                  <>
                                    <span>•</span>
                                    <span>{s.type}</span>
                                  </>
                                )}
                                {s.date_received && (
                                  <>
                                    <span>•</span>
                                    <span>Received: {new Date(s.date_received).toLocaleDateString('en-US')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant={s.status === 'Ongoing' ? 'default' : 'outline'} className="shadow-sm shrink-0">
                            {s.status || 'Pending'}
                          </Badge>
                        </div>
                        {s.request && (
                          <div className="text-xs text-muted-foreground/80 bg-muted/30 p-2 rounded-md border border-border/50">
                            <span className="font-medium text-muted-foreground">Request:</span> {s.request}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col min-h-0">
            {/* Upcoming Events Section */}
            <div className="flex-1 rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-0">
              <div className="p-5 border-b border-border flex items-center justify-between bg-card/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Upcoming Events</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Events scheduled for the future.</p>
                  </div>
                </div>
              </div>
              <div className="p-0 overflow-y-auto flex-1 min-h-0">
                {upcomingEvents.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center justify-center h-full">
                    <Calendar size={32} className="text-muted/50 mb-3" />
                    No upcoming events scheduled.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {upcomingEvents.map((s) => (
                      <div 
                        key={s.id} 
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => navigate(`/solicits?id=${s.id}`)}
                      >
                        <div className="space-y-1 w-full">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-foreground">
                              {s.event || 'Unnamed Event'}
                            </h4>
                            <div className="shrink-0 flex flex-col items-end text-sm text-right">
                              <span className="font-medium text-primary">
                                {s.event_date ? new Date(s.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                              </span>
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {formatEventTime(s.event_time) || 'No Time'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">{s.organization_name || 'No Org'}</span>
                            {s.control_number && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-primary/80">{s.control_number}</span>
                              </>
                            )}
                            {s.type && (
                              <>
                                <span>•</span>
                                <span>{s.type}</span>
                              </>
                            )}
                          </div>
                          
                          {s.request && (
                            <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1">
                              <span className="font-medium">Request:</span> {s.request}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
