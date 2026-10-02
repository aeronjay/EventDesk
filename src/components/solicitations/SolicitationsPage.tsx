import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  fetchSolicitations,
  deleteSolicitation,
  updateSolicitation,
  type Solicitation,
} from '@/lib/solicitations'
import { fetchFieldConfigs, type FieldConfig } from '@/lib/fieldConfigs'
import { Button, buttonVariants } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
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
  Filter,
  Paperclip,
} from 'lucide-react'
import { SolicitationDialog } from './SolicitationDialog.tsx'
import { SolicitationDetailPanel } from './SolicitationDetailPanel.tsx'
import { DeleteDialog } from './DeleteDialog.tsx'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const PAGE_SIZE = 100

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
  const { isSuperAdmin } = useAuth()
  const [solicitations, setSolicitations] = useState<Solicitation[]>([])
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  
  const [eventDateFrom, setEventDateFrom] = useState<string>('')
  const [eventDateTo, setEventDateTo] = useState<string>('')
  const [receivedDateFrom, setReceivedDateFrom] = useState<string>('')
  const [receivedDateTo, setReceivedDateTo] = useState<string>('')
  const [createdDateFrom, setCreatedDateFrom] = useState<string>('')
  const [createdDateTo, setCreatedDateTo] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('event_asc')
  
  const [currentPage, setCurrentPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)

  // Sheet states
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSolicitation, setEditingSolicitation] = useState<Solicitation | null>(null)
  const [viewingSolicitation, setViewingSolicitation] = useState<Solicitation | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingSolicitation, setDeletingSolicitation] = useState<Solicitation | null>(null)
  
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialViewId, setInitialViewId] = useState<string | null>(() => searchParams.get('id'))

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      const [solicits, configs] = await Promise.all([
        fetchSolicitations(),
        fetchFieldConfigs(),
      ])
      setSolicitations(solicits)
      setFieldConfigs(configs)
      
      setViewingSolicitation(prev => {
        if (!prev) return null
        const updated = solicits.find(s => s.id === prev.id)
        return updated || prev
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load solicitations')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])



  const typeOptions = useMemo(() => {
    const config = fieldConfigs.find((c) => c.field_name === 'type')
    return config?.options ?? []
  }, [fieldConfigs])

  const allStatusOptions = useMemo(() => {
    const config = fieldConfigs.find((c) => c.field_name === 'status')
    return config?.options ?? []
  }, [fieldConfigs])

  const filterStatusOptions = useMemo(() => {
    return allStatusOptions.filter(o => {
      const isHistory = ['Done', 'Discontinued'].includes(o)
      return showHistory ? isHistory : !isHistory
    })
  }, [allStatusOptions, showHistory])

  // Filter + search + sort
  const filtered = useMemo(() => {
    let result = solicitations

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.organization_name?.toLowerCase().includes(q) ||
          s.control_number?.toLowerCase().includes(q) ||
          s.event?.toLowerCase().includes(q) ||
          s.contact_person?.toLowerCase().includes(q) ||
          s.venue?.toLowerCase().includes(q)
      )
    }

    const getSortTime = (s: Solicitation, sortType: string) => {
       if (sortType.startsWith('event')) {
          if (!s.event_date) return null
          const d = new Date(s.event_date)
          if (s.event_time) {
            const timeMatch = s.event_time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
            if (timeMatch) {
               let hours = parseInt(timeMatch[1], 10)
               const mins = parseInt(timeMatch[2], 10)
               const ampm = timeMatch[3]?.toUpperCase()
               if (ampm === 'PM' && hours < 12) hours += 12
               if (ampm === 'AM' && hours === 12) hours = 0
               d.setHours(hours, mins, 0, 0)
            }
          }
          return d.getTime()
       } else if (sortType.startsWith('received')) {
          return s.date_received ? new Date(s.date_received).getTime() : null
       } else if (sortType.startsWith('created')) {
          return s.created_at ? new Date(s.created_at).getTime() : null
       }
       return null
    }

    let itemsWithTime = result.map(s => ({ item: s, time: getSortTime(s, sortBy) }))

    if (showHistory) {
      itemsWithTime = itemsWithTime.filter(x => ['Done', 'Discontinued'].includes(x.item.status || ''))
    } else {
      itemsWithTime = itemsWithTime.filter(x => !['Done', 'Discontinued'].includes(x.item.status || ''))
    }

    if (filterType !== 'all') {
      itemsWithTime = itemsWithTime.filter((x) => x.item.type === filterType)
    }
    if (filterStatus !== 'all') {
      itemsWithTime = itemsWithTime.filter((x) => x.item.status === filterStatus)
    }

    const applyDateFilter = (from: string, to: string, dateGetter: (s: Solicitation) => number | null) => {
        if (from) {
          const fromTime = new Date(from).getTime()
          itemsWithTime = itemsWithTime.filter(x => {
            const t = dateGetter(x.item)
            return t !== null && t >= fromTime
          })
        }
        if (to) {
          const toDate = new Date(to)
          toDate.setHours(23, 59, 59, 999)
          const toTime = toDate.getTime()
          itemsWithTime = itemsWithTime.filter(x => {
            const t = dateGetter(x.item)
            return t !== null && t <= toTime
          })
        }
    }

    const hasEventFilter = eventDateFrom || eventDateTo
    const hasReceivedFilter = receivedDateFrom || receivedDateTo
    const hasCreatedFilter = createdDateFrom || createdDateTo

    if (hasEventFilter) {
       applyDateFilter(eventDateFrom, eventDateTo, (s) => getSortTime(s, 'event'))
    } else if (hasReceivedFilter) {
       applyDateFilter(receivedDateFrom, receivedDateTo, (s) => getSortTime(s, 'received'))
    } else if (hasCreatedFilter) {
       applyDateFilter(createdDateFrom, createdDateTo, (s) => getSortTime(s, 'created'))
    }

    itemsWithTime.sort((a, b) => {
        if (a.time === null && b.time === null) return 0
        if (a.time === null) return 1
        if (b.time === null) return -1
        
        return sortBy.endsWith('_asc') ? a.time - b.time : b.time - a.time
    })

    return itemsWithTime.map(x => x.item)
  }, [solicitations, searchQuery, filterType, filterStatus, eventDateFrom, eventDateTo, receivedDateFrom, receivedDateTo, createdDateFrom, createdDateTo, sortBy])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType, filterStatus, eventDateFrom, eventDateTo, receivedDateFrom, receivedDateTo, createdDateFrom, createdDateTo, sortBy])

  // Handle URL id
  useEffect(() => {
    if (initialViewId && solicitations.length > 0) {
      const sToView = solicitations.find(s => s.id === initialViewId)
      if (sToView) {
        setViewingSolicitation(sToView)
        
        // Find if we need to switch page
        const index = filtered.findIndex(s => s.id === initialViewId)
        if (index !== -1) {
           setCurrentPage(Math.floor(index / PAGE_SIZE) + 1)
        }
        
        // Scroll to element after render
        setTimeout(() => {
           const row = document.getElementById(`row-${initialViewId}`)
           if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)

        // Clean up URL
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('id')
        setSearchParams(newParams, { replace: true })
        setInitialViewId(null)
      }
    }
  }, [solicitations, initialViewId, filtered, searchParams, setSearchParams])

  const handleAdd = () => {
    setEditingSolicitation(null)
    setSheetOpen(true)
  }

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
      
      setSolicitations(prev => prev.filter(s => s.id !== deletingSolicitation.id))
      if (viewingSolicitation?.id === deletingSolicitation.id) {
        setViewingSolicitation(null)
      }

      toast.success('Solicitation deleted successfully')
      setDeleteOpen(false)
      setDeletingSolicitation(null)
    } catch {
      toast.error('Failed to delete solicitation')
    }
  }

  const handleSaved = (savedRecord: Solicitation, isEdit: boolean) => {
    setSheetOpen(false)
    setEditingSolicitation(null)
    
    if (isEdit) {
      setSolicitations(prev => prev.map(s => s.id === savedRecord.id ? savedRecord : s))
      if (viewingSolicitation?.id === savedRecord.id) {
        setViewingSolicitation(savedRecord)
      }
    } else {
      setSolicitations(prev => [savedRecord, ...prev])
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

      const isMovedToHistory = !showHistory && ['Done', 'Discontinued'].includes(newStatus)
      const isMovedToActive = showHistory && !['Done', 'Discontinued'].includes(newStatus)

      if (isMovedToHistory || isMovedToActive) {
        toast.success(`Moved to ${isMovedToHistory ? 'History' : 'Active Solicits'}`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                // Optimistically revert
                setSolicitations((prev) => 
                  prev.map((item) => (item.id === s.id ? { ...item, status: previousStatus } : item))
                )
                if (viewingSolicitation?.id === s.id) {
                  setViewingSolicitation({ ...viewingSolicitation, status: previousStatus })
                }
                const reverted = await updateSolicitation(s.id, { status: previousStatus })
                setSolicitations((prev) => 
                  prev.map((item) => (item.id === s.id ? reverted : item))
                )
                if (viewingSolicitation?.id === s.id) {
                  setViewingSolicitation(reverted)
                }
                toast.success('Status reverted')
              } catch {
                toast.error('Failed to revert status')
              }
            }
          },
          duration: 5000,
        })
      } else {
        toast.success('Status updated')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const hasEventFilter = eventDateFrom !== '' || eventDateTo !== ''
  const hasReceivedFilter = receivedDateFrom !== '' || receivedDateTo !== ''
  const hasCreatedFilter = createdDateFrom !== '' || createdDateTo !== ''

  const disableEvent = hasReceivedFilter || hasCreatedFilter
  const disableReceived = hasEventFilter || hasCreatedFilter
  const disableCreated = hasEventFilter || hasReceivedFilter

  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all' || hasEventFilter || hasReceivedFilter || hasCreatedFilter || sortBy !== 'event_asc' || searchQuery.trim() !== ''

  return (
    <div className="flex flex-col h-full p-6 min-h-0">
      {/* Content wrapper for side-by-side layout */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 min-w-0 gap-6">
        
        {/* Left Column (Header + Search + Table) */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 gap-4 sm:gap-6">
          
          {/* Search + Filters bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            id="search-solicitations"
            placeholder="Search by name, control no., event…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>



        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger className={buttonVariants({ variant: 'outline', className: 'gap-2' })}>
            <Filter size={16} />
            Filters
            {(filterType !== 'all' || filterStatus !== 'all' || hasEventFilter || hasReceivedFilter || hasCreatedFilter || sortBy !== 'event_asc') && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-sm">Active</Badge>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-4" align="start">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <h4 className="font-semibold leading-none mb-3">Filters & Sorting</h4>

              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event_asc">Event Date (Ascending)</SelectItem>
                    <SelectItem value="event_desc">Event Date (Descending)</SelectItem>
                    <SelectItem value="received_asc">Date Received (Ascending)</SelectItem>
                    <SelectItem value="received_desc">Date Received (Descending)</SelectItem>
                    <SelectItem value="created_asc">Date Created (Ascending)</SelectItem>
                    <SelectItem value="created_desc">Date Created (Descending)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {typeOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {filterStatusOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={`space-y-2 p-3 border rounded-md ${disableEvent ? 'opacity-50 pointer-events-none' : ''}`}>
                <Label>Event Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={eventDateFrom} onChange={(e) => setEventDateFrom(e.target.value)} title="From" />
                  <Input type="date" value={eventDateTo} onChange={(e) => setEventDateTo(e.target.value)} title="To" />
                </div>
              </div>

              <div className={`space-y-2 p-3 border rounded-md ${disableReceived ? 'opacity-50 pointer-events-none' : ''}`}>
                <Label>Date Received Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={receivedDateFrom} onChange={(e) => setReceivedDateFrom(e.target.value)} title="From" />
                  <Input type="date" value={receivedDateTo} onChange={(e) => setReceivedDateTo(e.target.value)} title="To" />
                </div>
              </div>

              <div className={`space-y-2 p-3 border rounded-md ${disableCreated ? 'opacity-50 pointer-events-none' : ''}`}>
                <Label>Date Created Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={createdDateFrom} onChange={(e) => setCreatedDateFrom(e.target.value)} title="From" />
                  <Input type="date" value={createdDateTo} onChange={(e) => setCreatedDateTo(e.target.value)} title="To" />
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => {
                  setFilterType('all')
                  setFilterStatus('all')
                  setEventDateFrom('')
                  setEventDateTo('')
                  setReceivedDateFrom('')
                  setReceivedDateTo('')
                  setCreatedDateFrom('')
                  setCreatedDateTo('')
                  setSortBy('event_asc')
                }}
              >
                Reset Filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('')
              setFilterType('all')
              setFilterStatus('all')
              setEventDateFrom('')
              setEventDateTo('')
              setReceivedDateFrom('')
              setReceivedDateTo('')
              setCreatedDateFrom('')
              setCreatedDateTo('')
              setSortBy('event_asc')
            }}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        )}
        {!showHistory && (
          <Button onClick={handleAdd} className="gap-2 shrink-0 sm:ml-auto">
            <Plus size={16} />
            Add Solicitation
          </Button>
        )}
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
        ) : paginated.length === 0 ? (
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
                  {paginated.map((s) => (
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
                            const mapping = cnConfig?.color_mappings?.find(m => m.color === s.control_number_color)
                            
                            return (
                              <Badge 
                                style={{ backgroundColor: s.control_number_color, color: '#fff' }} 
                                variant="outline" 
                                className="border-0 text-xs px-1.5 py-0"
                                title={mapping?.label || 'Color'}
                              >
                                {mapping?.label || '—'}
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
                            {isSuperAdmin && (
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
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length} record{filtered.length !== 1 ? 's' : ''}
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
