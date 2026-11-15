import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  fetchPaginatedSolicitations,
  fetchSolicitation,
  deleteSolicitation,
  updateSolicitation,
  type Solicitation,
} from '@/lib/solicitations'
import { fetchFieldConfigs, type FieldConfig } from '@/lib/fieldConfigs'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Paperclip,
} from 'lucide-react'
import { SolicitationDialog } from './SolicitationDialog.tsx'
import { SolicitationDetailPanel } from './SolicitationDetailPanel.tsx'
import { DeleteDialog } from './DeleteDialog.tsx'
import { SolicitationFilterBar } from './SolicitationFilterBar.tsx'
import { EMPTY_FILTERS, DEFAULT_SORT, countActiveFilters, type SolicitationFilters } from './solicitationFilters'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { canDeleteSolicitation } from '@/lib/permissions'

const PAGE_SIZE = 25

// Filters are remembered per tab (Solicits / History) for the browser session
interface StoredView {
  search: string
  filters: SolicitationFilters
  sortBy: string
}

const loadStoredView = (key: string): StoredView | null => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredView>
    return {
      search: parsed.search ?? '',
      filters: { ...EMPTY_FILTERS, ...parsed.filters },
      sortBy: parsed.sortBy ?? DEFAULT_SORT,
    }
  } catch {
    return null
  }
}

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

const isEventPassed = (dateStr?: string | null, timeStr?: string | null) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (timeStr) {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const mins = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      d.setHours(hours, mins, 0, 0);
    } else {
      d.setHours(23, 59, 59, 999);
    }
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d.getTime() < Date.now();
};

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success'> = {
  Pending: 'outline',
  Ongoing: 'default',
  Done: 'success',
  Discontinued: 'destructive',
}

export default function SolicitationsPage({ showHistory = false }: { showHistory?: boolean }) {
  const { user, isSuperAdmin } = useAuth()
  const [solicitations, setSolicitations] = useState<Solicitation[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([])
  const [loading, setLoading] = useState(true)
  const storageKey = `qsolicit:view:${showHistory ? 'history' : 'active'}`
  const [stored] = useState(() => loadStoredView(storageKey))
  const [searchQuery, setSearchQuery] = useState(stored?.search ?? '')
  const [filters, setFilters] = useState<SolicitationFilters>(stored?.filters ?? EMPTY_FILTERS)
  const [sortBy, setSortBy] = useState<string>(stored?.sortBy ?? DEFAULT_SORT)

  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ search: searchQuery, filters, sortBy }))
    } catch {
      // storage unavailable — filters just won't be remembered
    }
  }, [storageKey, searchQuery, filters, sortBy])

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState(stored?.search ?? '')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Sheet states
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSolicitation, setEditingSolicitation] = useState<Solicitation | null>(null)
  const [viewingSolicitation, setViewingSolicitation] = useState<Solicitation | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingSolicitation, setDeletingSolicitation] = useState<Solicitation | null>(null)
  
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialViewId, setInitialViewId] = useState<string | null>(() => searchParams.get('id'))

  // ── Server-side paginated data loading ──
  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      const [result, configs] = await Promise.all([
        fetchPaginatedSolicitations({
          page: currentPage,
          pageSize: PAGE_SIZE,
          showHistory,
          includeHistory: !showHistory && filters.includeHistory,
          search: debouncedSearch,
          types: filters.types,
          statuses: filters.statuses,
          colors: filters.colors,
          sortBy,
          dateField: filters.dateField,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        }),
        fetchFieldConfigs(),
      ])
      setSolicitations(result.data)
      setTotalCount(result.totalCount)
      setFieldConfigs(configs)
      
      setViewingSolicitation(prev => {
        if (!prev) return null
        const updated = result.data.find(s => s.id === prev.id)
        return updated || prev
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load solicitations')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [currentPage, showHistory, debouncedSearch, filters, sortBy])

  // Reload data when any filter/page changes
  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset page when filters change (not when page changes)
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, filters, sortBy])

  // Handle URL id — fetch the specific record if needed
  useEffect(() => {
    if (initialViewId && !loading) {
      const found = solicitations.find(s => s.id === initialViewId)
      if (found) {
        setViewingSolicitation(found)
        setTimeout(() => {
          const row = document.getElementById(`row-${initialViewId}`)
          if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      } else {
        // Record not on current page — fetch it directly
        fetchSolicitation(initialViewId).then(s => {
          setViewingSolicitation(s)
        }).catch(() => {
          toast.error('Could not find the requested solicitation')
        })
      }

      // Clean up URL
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('id')
      setSearchParams(newParams, { replace: true })
      setInitialViewId(null)
    }
  }, [initialViewId, solicitations, loading, searchParams, setSearchParams])

  const typeOptions = useMemo(() => {
    const config = fieldConfigs.find((c) => c.field_name === 'type')
    return config?.options ?? []
  }, [fieldConfigs])

  const allStatusOptions = useMemo(() => {
    const config = fieldConfigs.find((c) => c.field_name === 'status')
    return config?.options ?? []
  }, [fieldConfigs])

  const colorMappings = useMemo(
    () => fieldConfigs.find((c) => c.field_name === 'control_number')?.color_mappings ?? [],
    [fieldConfigs]
  )

  const filterStatusOptions = useMemo(() => {
    return allStatusOptions.filter(o => {
      const isHistory = ['Done', 'Discontinued'].includes(o)
      return showHistory ? isHistory : !isHistory
    })
  }, [allStatusOptions, showHistory])

  // "All" scope on the Solicits tab: active and history together
  const showingAll = !showHistory && filters.includeHistory

  // Pagination computed values
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const handleAdd = () => {
    setEditingSolicitation(null)
    setSheetOpen(true)
  }

  // `?new=1` (from the dashboard) opens the create dialog directly
  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    handleAdd()
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('new')
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  const handleEdit = (s: Solicitation) => {
    setEditingSolicitation(s)
    setSheetOpen(true)
  }

  const handleView = (s: Solicitation) => {
    setViewingSolicitation(s)
  }

  const toggleView = (s: Solicitation) => {
    if (viewingSolicitation?.id === s.id) {
      setViewingSolicitation(null)
    } else {
      setViewingSolicitation(s)
    }
  }

  const handleDeleteClick = (s: Solicitation) => {
    setDeletingSolicitation(s)
    setDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingSolicitation) return
    try {
      await deleteSolicitation(deletingSolicitation.id)
      
      if (viewingSolicitation?.id === deletingSolicitation.id) {
        setViewingSolicitation(null)
      }

      toast.success('Solicitation deleted successfully')
      setDeleteOpen(false)
      setDeletingSolicitation(null)
      
      // Reload current page from server
      loadData(false)
    } catch {
      toast.error('Failed to delete solicitation')
    }
  }

  const handleSaved = (savedRecord: Solicitation, isEdit: boolean) => {
    setSheetOpen(false)
    setEditingSolicitation(null)
    
    if (isEdit) {
      // Update in local state for immediate feedback
      setSolicitations(prev => prev.map(s => s.id === savedRecord.id ? savedRecord : s))
      if (viewingSolicitation?.id === savedRecord.id) {
        setViewingSolicitation(savedRecord)
      }
    } else {
      // New record — reload from server to get correct ordering/pagination
      loadData(false)
    }
  }

  const handleStatusChange = async (s: Solicitation, newStatus: string) => {
    const previousStatus = s.status || ''
    if (previousStatus === newStatus) return

    try {
      // Optimistic UI update
      setSolicitations((prev) => 
        prev.map((item) => (item.id === s.id ? { ...item, status: newStatus } : item))
      )
      if (viewingSolicitation?.id === s.id) {
         setViewingSolicitation({ ...viewingSolicitation, status: newStatus })
      }

      const updated = await updateSolicitation(s.id, { status: newStatus })
      
      // Update with database values
      setSolicitations((prev) => 
        prev.map((item) => (item.id === s.id ? updated : item))
      )
      if (viewingSolicitation?.id === s.id) {
         setViewingSolicitation(updated)
      }

      // In the "All" scope the row stays on screen, so there is nothing to move
      const isMovedToHistory = !showHistory && !showingAll && ['Done', 'Discontinued'].includes(newStatus)
      const isMovedToActive = showHistory && !['Done', 'Discontinued'].includes(newStatus)

      if (isMovedToHistory || isMovedToActive) {
        toast.success(`Moved to ${isMovedToHistory ? 'History' : 'Active Solicits'}`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                const reverted = await updateSolicitation(s.id, { status: previousStatus })
                setSolicitations((prev) => 
                  prev.map((item) => (item.id === s.id ? reverted : item))
                )
                if (viewingSolicitation?.id === s.id) {
                  setViewingSolicitation(reverted)
                }
                toast.success('Status reverted')
                // Reload to reflect the change
                loadData(false)
              } catch {
                toast.error('Failed to revert status')
              }
            }
          },
          duration: 5000,
        })
        // Reload to remove the item from view
        setTimeout(() => loadData(false), 500)
      } else {
        toast.success('Status updated')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const hasActiveFilters = countActiveFilters(filters) > 0 || searchQuery.trim() !== ''

  const clearAllFilters = () => {
    setSearchQuery('')
    setFilters(EMPTY_FILTERS)
  }

  return (
    <div className="flex flex-col h-full p-6 min-h-0">
      {/* Content wrapper for side-by-side layout */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 min-w-0 gap-6">
        
        {/* Left Column (Header + Search + Table) */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 gap-4 sm:gap-6">
          
          {/* Search + filters */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  id="search-solicitations"
                  placeholder="Search organization, control no., event, contact, venue…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {!showHistory && (
                <Button onClick={handleAdd} className="ml-auto gap-2 shrink-0">
                  <Plus size={16} />
                  <span className="hidden sm:inline">Add Solicitation</span>
                </Button>
              )}
            </div>

            <SolicitationFilterBar
              filters={filters}
              onChange={setFilters}
              sortBy={sortBy}
              onSortChange={setSortBy}
              typeOptions={typeOptions}
              statusOptions={showingAll ? allStatusOptions : filterStatusOptions}
              colorMappings={colorMappings}
              showScope={!showHistory}
              onClearAll={clearAllFilters}
              canClearAll={hasActiveFilters}
            />
          </div>

      {/* Table Container */}
      <div className="rounded-xl border border-border bg-card flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {/* Skeleton header */}
            <div className="flex gap-4 border-b border-border bg-muted/30 px-4 py-3">
              {[100, 80, 160, 120, 90, 40].map((w, i) => (
                <div key={i} className="h-4 rounded bg-muted animate-pulse" style={{ width: w }} />
              ))}
            </div>
            {/* Skeleton rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                {[100, 80, 160, 120, 90, 40].map((w, j) => (
                  <div key={j} className="h-4 rounded bg-muted/60 animate-pulse" style={{ width: w }} />
                ))}
              </div>
            ))}
          </div>
        ) : solicitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <FileText size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              {hasActiveFilters ? 'No results found' : 'No solicitations yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-xs">
              {hasActiveFilters
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first solicitation record'}
            </p>
            {!hasActiveFilters && !showHistory && (
              <Button onClick={handleAdd} size="sm" className="gap-2">
                <Plus size={14} />
                Add Solicitation
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              <Table>
                <TableHeader className="sticky top-0 z-10 shadow-sm">
                  <TableRow className="bg-muted/95 hover:bg-muted/95">
                    <TableHead className="w-[150px] min-w-[150px] max-w-[150px]">Type</TableHead>
                    <TableHead className="whitespace-nowrap">Control No.</TableHead>
                    <TableHead className="whitespace-nowrap">Date Received</TableHead>
                    <TableHead className="whitespace-nowrap">Organization</TableHead>
                    <TableHead className="whitespace-nowrap">Sub Area</TableHead>
                    <TableHead className="whitespace-nowrap">Event</TableHead>
                    <TableHead className="whitespace-nowrap">Date & Time</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">Request</TableHead>
                    <TableHead className="whitespace-nowrap">Venue</TableHead>
                    <TableHead className="whitespace-nowrap">Contact Person</TableHead>
                    <TableHead className="whitespace-nowrap">Contact Number</TableHead>
                    <TableHead className="whitespace-nowrap">Recom</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">Remarks</TableHead>
                    <TableHead className="whitespace-nowrap">Voters Turn Out</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">Additional Note</TableHead>
                    <TableHead className="w-[80px]">Files</TableHead>
                    <TableHead className="w-[50px] sticky right-0 bg-muted/30" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitations.map((s) => (
                    <TableRow
                      key={s.id}
                      id={`row-${s.id}`}
                      className="group cursor-pointer data-[state=selected]:bg-primary/10 hover:data-[state=selected]:bg-primary/15"
                      onClick={() => toggleView(s)}
                      data-state={viewingSolicitation?.id === s.id ? 'selected' : undefined}
                    >
                      <TableCell className="w-[150px] min-w-[150px] max-w-[150px]">
                        <Badge variant="secondary" className="font-normal max-w-full" title={s.type || ''}>
                          <span className="truncate block">{s.type || '—'}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{s.control_number || '—'}</span>
                          {s.control_number_color && (() => {
                            const cnConfig = fieldConfigs.find(c => c.field_name === 'control_number')
                            const mapping = cnConfig?.color_mappings?.find(m => m.label === s.control_number_color)
                            
                            return (
                              <Badge 
                                style={{ backgroundColor: mapping?.color || '#ccc', color: '#fff' }} 
                                variant="outline" 
                                className="border-0 text-xs px-1.5 py-0"
                                title={mapping?.label || s.control_number_color}
                              >
                                {mapping?.label || s.control_number_color}
                              </Badge>
                            )
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.date_received
                          ? new Date(s.date_received).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                          : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium text-sm">{s.organization_name || '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.sub_area || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.event || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>
                            {[
                              s.event_date && new Date(s.event_date).toLocaleDateString('en-PH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              }),
                              formatEventTime(s.event_time)
                            ].filter(Boolean).join(' at ') || '—'}
                          </span>
                          {isEventPassed(s.event_date, s.event_time) && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 leading-none flex items-center">Passed</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="focus:outline-none">
                            {s.status ? (
                              <Badge variant={(statusVariantMap[s.status] as any) ?? 'outline'} className="hover:opacity-80 transition-opacity cursor-pointer">
                                {s.status}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">—</span>
                            )}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {allStatusOptions.map((opt) => (
                              <DropdownMenuItem
                                key={opt}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStatusChange(s, opt)
                                }}
                              >
                                {opt}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {s.request || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.venue || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.contact_person || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.contact_number || '—'}
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.recom || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {s.remarks || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.voters_turnout || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {s.additional_note || '—'}
                      </TableCell>
                      <TableCell>
                        {s.attachments && s.attachments.length > 0 ? (
                          <Badge variant="secondary" className="gap-1 px-1.5 font-normal text-xs">
                            <Paperclip size={12} />
                            {s.attachments.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="sticky right-0 bg-card group-hover:bg-muted/50 transition-colors">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent hover:text-accent-foreground"
                          >
                            <MoreHorizontal size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(s) }}>
                              <Eye size={14} className="mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(s) }}>
                              <Pencil size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {canDeleteSolicitation(s, { userId: user?.id, isSuperAdmin }) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(s) }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 1
                  )
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-sm text-muted-foreground">…</span>
                      )}
                      <Button
                        variant={currentPage === p ? 'default' : 'ghost'}
                        size="icon"
                        className="h-8 w-8 text-sm"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    </span>
                  ))}
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

      {/* Detail Panel */}
      {viewingSolicitation && (
        <div className="rounded-xl border border-border bg-card flex flex-col flex-1 lg:flex-none lg:w-[400px] shrink-0 overflow-hidden">
          <SolicitationDetailPanel
            solicitation={viewingSolicitation}
            fieldConfigs={fieldConfigs}
            onEdit={(s) => handleEdit(s)}
            onDelete={(s) => handleDeleteClick(s)}
            onClose={() => setViewingSolicitation(null)}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}
      </div>

      {/* Dialogs */}
      <SolicitationDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        solicitation={editingSolicitation}
        fieldConfigs={fieldConfigs}
        onSaved={handleSaved}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        solicitation={deletingSolicitation}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
