import { useState, useEffect } from 'react'
import {
  fetchFieldConfigs,
  updateFieldConfig,
  type FieldConfig,
} from '@/lib/fieldConfigs'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Shield, Settings2 } from 'lucide-react'
import { FieldConfigSheet } from './FieldConfigSheet.tsx'
import { toast } from 'sonner'

export default function AdminPage() {
  const { isSuperAdmin } = useAuth()
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editingConfig, setEditingConfig] = useState<FieldConfig | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const loadConfigs = async () => {
    try {
      setLoading(true)
      const configs = await fetchFieldConfigs()
      setFieldConfigs(configs)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load field configurations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const handleEdit = (config: FieldConfig) => {
    setEditingConfig(config)
    setSheetOpen(true)
  }

  const handleSaved = async (id: string, updates: Partial<FieldConfig>) => {
    try {
      await updateFieldConfig(id, updates)
      toast.success('Field configuration updated')
      setSheetOpen(false)
      setEditingConfig(null)
      loadConfigs()
    } catch {
      toast.error('Failed to update field configuration')
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <Shield size={24} className="text-destructive" />
        </div>
        <h3 className="text-base font-medium text-foreground mb-1">Access Denied</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          You don't have permission to access this page. Contact your administrator.
        </p>
      </div>
    )
  }

  const fieldTypeLabel: Record<string, string> = {
    text: 'Text',
    select: 'Dropdown',
    number: 'Number',
    date: 'Date',
    time: 'Time',
    textarea: 'Long Text',
  }

  return (
    <div className="flex flex-col h-full gap-6 p-6 min-h-0">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 size={20} className="text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Field Configuration</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure what values each solicitation field accepts. Changes apply to all users.
        </p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card flex flex-col flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            <div className="flex gap-4 border-b border-border bg-muted/30 px-4 py-3">
              {[140, 80, 70, 200, 40].map((w, i) => (
                <div key={i} className="h-4 rounded bg-muted animate-pulse" style={{ width: w }} />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                {[140, 80, 70, 200, 40].map((w, j) => (
                  <div key={j} className="h-4 rounded bg-muted/60 animate-pulse" style={{ width: w }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 shadow-sm">
                <TableRow className="bg-muted/95 hover:bg-muted/95">
                  <TableHead>Field</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[90px]">Required</TableHead>
                  <TableHead>Options / Validation</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldConfigs.map((config) => (
                  <TableRow key={config.id} className="group">
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{config.label}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {config.field_name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {fieldTypeLabel[config.field_type] ?? config.field_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {config.is_required ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {config.field_type === 'select' && config.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {config.options.map((opt) => (
                            <Badge key={opt} variant="outline" className="text-xs font-normal">
                              {opt}
                            </Badge>
                          ))}
                        </div>
                      ) : config.validation_rule ? (
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {config.validation_rule}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleEdit(config)}
                      >
                        <Pencil size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit sheet */}
      <FieldConfigSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        fieldConfig={editingConfig}
        onSave={handleSaved}
      />
    </div>
  )
}
