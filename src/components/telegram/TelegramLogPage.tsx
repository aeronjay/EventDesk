import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchPaginatedTelegramSends, type TelegramSend } from '@/lib/telegram'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Send, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 25

type StatusFilter = 'all' | 'success' | 'failed'

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function TelegramLogPage() {
  const navigate = useNavigate()
  const [sends, setSends] = useState<TelegramSend[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchPaginatedTelegramSends({
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        status: statusFilter,
      })
      setSends(result.data)
      setTotalCount(result.totalCount)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load Telegram log')
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedSearch, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset page when filters change (not when page changes)
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const openSolicitation = (send: TelegramSend) => {
    if (!send.solicitation_id) {
      toast.error('This solicitation has been deleted')
      return
    }
    navigate(`/solicits?id=${send.solicitation_id}`)
  }

  const hasActiveFilters = statusFilter !== 'all' || searchQuery.trim() !== ''

  return (
    <div className="flex flex-col h-full p-6 min-h-0 gap-4 sm:gap-6">
      {/* Search + Filters bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            id="search-telegram-log"
            placeholder="Search by name, control no., event, sender…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-border bg-card flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                {[120, 80, 160, 160, 90, 140, 60].map((w, j) => (
                  <div key={j} className="h-4 rounded bg-muted/60 animate-pulse" style={{ width: w }} />
                ))}
              </div>
            ))}
          </div>
        ) : sends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Send size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              {hasActiveFilters ? 'No results found' : 'Nothing sent yet'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              {hasActiveFilters
                ? 'Try adjusting your search or filters'
                : 'Solicitations sent to Telegram will appear here'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 shadow-sm">
                  <TableRow className="bg-muted/95 hover:bg-muted/95">
                    <TableHead className="whitespace-nowrap">Sent At</TableHead>
                    <TableHead className="whitespace-nowrap">Control No.</TableHead>
                    <TableHead className="whitespace-nowrap">Organization</TableHead>
                    <TableHead className="whitespace-nowrap">Event</TableHead>
                    <TableHead className="whitespace-nowrap">Event Date</TableHead>
                    <TableHead className="whitespace-nowrap">Sent By</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.map((send) => (
                    <TableRow
                      key={send.id}
                      className="cursor-pointer"
                      onClick={() => openSolicitation(send)}
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(send.sent_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium whitespace-nowrap">
                        {send.control_number || '—'}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {send.organization_name || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate" title={send.event || ''}>
                        {send.event || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(send.event_date)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {send.sent_by_email || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {send.status === 'success' ? (
                          <Badge variant="success">Sent</Badge>
                        ) : (
                          <Badge variant="destructive" title={send.error || ''}>Failed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex-none flex items-center justify-between border-t border-border px-4 py-3 bg-card">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, totalCount)} of{' '}
                {totalCount} record{totalCount !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="px-2 text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
