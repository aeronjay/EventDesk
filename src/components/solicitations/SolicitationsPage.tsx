import { useState, useEffect, useMemo } from 'react'
import {
  fetchSolicitations,
  deleteSolicitation,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from 'lucide-react'
import { SolicitationSheet } from './SolicitationSheet.tsx'
import { SolicitationDetailSheet } from './SolicitationDetailSheet.tsx'
import { DeleteDialog } from './DeleteDialog.tsx'
import { toast } from 'sonner'

const PAGE_SIZE = 100

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Pending: 'outline',
  Ongoing: 'default',
  Done: 'secondary',
  Discontinued: 'destructive',
}

export default function SolicitationsPage() {
  const [solicitations, setSolicitations] = useState<Solicitation[]>([])
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Sheet states
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSolicitation, setEditingSolicitation] = useState<Solicitation | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [viewingSolicitation, setViewingSolicitation] = useState<Solicitation | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingSolicitation, setDeletingSolicitation] = useState<Solicitation | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [solicits, configs] = await Promise.all([
        fetchSolicitations(),
        fetchFieldConfigs(),
      ])
      setSolicitations(solicits)
      setFieldConfigs(configs)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load solicitations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])



  const typeOptions = useMemo(() => {
    const config = fieldConfigs.find((c) => c.field_name === 'type')
    return config?.options ?? []
  }, [fieldConfigs])

  // Filter + search
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

    if (typeFilter !== 'all') {
      result = result.filter((s) => s.type === typeFilter)
    }

    return result
  }, [solicitations, searchQuery, typeFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, typeFilter])

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
    setDetailOpen(true)
  }

  const handleDeleteClick = (s: Solicitation) => {
    setDeletingSolicitation(s)
    setDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingSolicitation) return
    try {
      await deleteSolicitation(deletingSolicitation.id)
      toast.success('Solicitation deleted successfully')
      setDeleteOpen(false)
      setDeletingSolicitation(null)
      loadData()
    } catch {
      toast.error('Failed to delete solicitation')
    }
  }

  const handleSaved = () => {
    setSheetOpen(false)
    setEditingSolicitation(null)
    loadData()
  }

  const hasActiveFilters = typeFilter !== 'all' || searchQuery.trim() !== ''

  return (
    <div className="flex flex-col h-full gap-6 p-6 min-h-0">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Solicitations</h2>
          <p className="text-sm text-muted-foreground">
            Manage and track all solicitation records
          </p>
        </div>
        <Button onClick={handleAdd} className="gap-2 shrink-0">
          <Plus size={16} />
          Add Solicitation
        </Button>
      </div>

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



        {typeOptions.length > 0 && (
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'all')}>
            <SelectTrigger id="filter-type" className="w-[160px]">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </div>
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
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('')
              setTypeFilter('all')
            }}
            className="text-muted-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card flex flex-col flex-1 min-h-0 overflow-hidden">
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
            {!hasActiveFilters && (
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
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="whitespace-nowrap">Control No.</TableHead>
                    <TableHead className="whitespace-nowrap">Date Received</TableHead>
                    <TableHead className="whitespace-nowrap">Organization</TableHead>
                    <TableHead className="whitespace-nowrap">Event</TableHead>
                    <TableHead className="whitespace-nowrap">Date & Time</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">Request</TableHead>
                    <TableHead className="whitespace-nowrap">Venue</TableHead>
                    <TableHead className="whitespace-nowrap">Contact Person</TableHead>
                    <TableHead className="whitespace-nowrap">Contact Number</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Recom</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">Remarks</TableHead>
                    <TableHead className="whitespace-nowrap">Voters Turn Out</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">Additional Note</TableHead>
                    <TableHead className="w-[50px] sticky right-0 bg-muted/30" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((s) => (
                    <TableRow
                      key={s.id}
                      className="group cursor-pointer"
                      onClick={() => handleView(s)}
                    >
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary" className="font-normal">{s.type || '—'}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium whitespace-nowrap">
                        {s.control_number || '—'}
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
                        {s.event || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {[
                          s.event_date && new Date(s.event_date).toLocaleDateString('en-PH'),
                          s.event_time
                        ].filter(Boolean).join(' at ') || '—'}
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
                      <TableCell className="whitespace-nowrap">
                        {s.status ? (
                          <Badge variant={statusVariantMap[s.status] ?? 'outline'}>
                            {s.status}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(s) }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
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

      {/* Sheets & Dialogs */}
      <SolicitationSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        solicitation={editingSolicitation}
        fieldConfigs={fieldConfigs}
        onSaved={handleSaved}
      />

      <SolicitationDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        solicitation={viewingSolicitation}
        fieldConfigs={fieldConfigs}
        onEdit={(s) => {
          setDetailOpen(false)
          handleEdit(s)
        }}
        onDelete={(s) => {
          setDetailOpen(false)
          handleDeleteClick(s)
        }}
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
