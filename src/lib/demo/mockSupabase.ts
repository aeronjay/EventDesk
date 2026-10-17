// In-memory stand-in for the Supabase client, used only in demo mode.
// It implements just the query-builder surface this app uses, so the real
// app code runs unchanged. Data lives in memory and resets on page reload.
import { createSeed, DEMO_USER_ID } from './seed'

type Row = Record<string, any>
type Result = { data: any; error: { message: string; code?: string } | null; count?: number | null }

const db = createSeed() as Record<string, Row[]>

const likeToRegExp = (pattern: string) =>
  new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i')

const parseList = (raw: string) => [...raw.matchAll(/"([^"]*)"/g)].map((m) => m[1])

const compare = (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0)

class QueryBuilder implements PromiseLike<Result> {
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private payload: any = null
  private returning = false
  private countMode = false
  private headOnly = false
  private filters: ((r: Row) => boolean)[] = []
  private sorts: { col: string; asc: boolean; nullsFirst?: boolean }[] = []
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private limitN: number | null = null
  private singleMode: 'one' | 'maybe' | null = null
  private conflictKey: string | null = null

  private table: string

  constructor(table: string) {
    this.table = table
  }

  select(_cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.action === 'select') {
      this.countMode = !!opts?.count
      this.headOnly = !!opts?.head
    }
    this.returning = true
    return this
  }
  insert(payload: Row | Row[]) { this.action = 'insert'; this.payload = payload; return this }
  update(payload: Row) { this.action = 'update'; this.payload = payload; return this }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    this.action = 'upsert'
    this.payload = payload
    this.conflictKey = opts?.onConflict ?? null
    return this
  }
  delete() { this.action = 'delete'; return this }

  private where(fn: (r: Row) => boolean) { this.filters.push(fn); return this }
  eq(col: string, v: any) { return this.where((r) => r[col] === v) }
  neq(col: string, v: any) { return this.where((r) => r[col] !== v) }
  gte(col: string, v: any) { return this.where((r) => r[col] != null && r[col] >= v) }
  lte(col: string, v: any) { return this.where((r) => r[col] != null && r[col] <= v) }
  in(col: string, vals: any[]) { return this.where((r) => vals.includes(r[col])) }
  not(col: string, op: string, v: any) {
    if (op === 'in') {
      const vals = parseList(String(v))
      return this.where((r) => !vals.includes(r[col]))
    }
    if (op === 'is') return this.where((r) => (v === null ? r[col] != null : r[col] !== v))
    return this.where((r) => r[col] !== v)
  }
  or(expr: string) {
    // Supports "col.ilike.%term%,col2.ilike.%term%"
    const parts = expr.split(/,(?=[a-z_]+\.ilike\.)/).map((p) => {
      const [col, , ...rest] = p.split('.')
      return { col, re: likeToRegExp(rest.join('.')) }
    })
    return this.where((r) => parts.some(({ col, re }) => r[col] != null && re.test(String(r[col]))))
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.sorts.push({ col, asc: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst })
    return this
  }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this }
  limit(n: number) { this.limitN = n; return this }
  maybeSingle() { this.singleMode = 'maybe'; return this }
  single() { this.singleMode = 'one'; return this }

  then<A = Result, B = never>(
    onfulfilled?: ((v: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((e: any) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return new Promise<Result>((resolve) => setTimeout(() => resolve(this.execute()), 120)).then(onfulfilled, onrejected)
  }

  private execute(): Result {
    const rows = (db[this.table] ??= [])
    const now = new Date().toISOString()
    let affected: Row[] = []

    if (this.action === 'insert' || this.action === 'upsert') {
      const items: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
      for (const item of items) {
        const key = this.conflictKey
        const existing = this.action === 'upsert'
          ? rows.find((r) => (key ? r[key] === item[key] : r.user_id !== undefined ? r.user_id === item.user_id : r.id === item.id))
          : undefined
        if (existing) {
          Object.assign(existing, item)
          affected.push(existing)
        } else {
          const row: Row = { ...item }
          if (this.table !== 'app_settings' && this.table !== 'user_settings' && !row.id) row.id = crypto.randomUUID()
          if (this.table === 'solicitations' || this.table === 'field_configs') {
            row.created_at ??= now
            row.updated_at ??= now
          }
          rows.push(row)
          affected.push(row)
        }
      }
    } else {
      const matched = rows.filter((r) => this.filters.every((f) => f(r)))
      if (this.action === 'update') {
        matched.forEach((r) => Object.assign(r, this.payload))
        affected = matched
      } else if (this.action === 'delete') {
        db[this.table] = rows.filter((r) => !matched.includes(r))
        affected = matched
      } else {
        affected = matched
      }
    }

    const total = affected.length

    if (this.action === 'select') {
      for (const s of [...this.sorts].reverse()) {
        affected = [...affected].sort((a, b) => {
          const av = a[s.col], bv = b[s.col]
          if (av == null || bv == null) {
            if (av == null && bv == null) return 0
            const nullsFirst = s.nullsFirst ?? !s.asc
            return (av == null ? -1 : 1) * (nullsFirst ? 1 : -1)
          }
          return compare(av, bv) * (s.asc ? 1 : -1)
        })
      }
      if (this.rangeFrom !== null) affected = affected.slice(this.rangeFrom, (this.rangeTo ?? 0) + 1)
      if (this.limitN !== null) affected = affected.slice(0, this.limitN)
    }

    const out = affected.map((r) => ({ ...r }))
    const count = this.countMode ? total : null

    if (this.headOnly) return { data: null, error: null, count }
    if (this.action !== 'select' && !this.returning) return { data: null, error: null, count }
    if (this.singleMode === 'maybe') return { data: out[0] ?? null, error: null, count }
    if (this.singleMode === 'one') {
      return out.length === 1
        ? { data: out[0], error: null, count }
        : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count }
    }
    return { data: out, error: null, count }
  }
}

// ── Auth ──
const demoUser = {
  id: DEMO_USER_ID,
  email: 'demo@eventdesk.app',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
}
const makeSession = () => ({
  access_token: 'demo-token',
  refresh_token: 'demo-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: demoUser,
})

let session: ReturnType<typeof makeSession> | null = makeSession()
const listeners = new Set<(event: string, session: any) => void>()
const emit = (event: string) => listeners.forEach((cb) => cb(event, session))

const auth = {
  async getSession() {
    return { data: { session }, error: null }
  },
  onAuthStateChange(cb: (event: string, session: any) => void) {
    listeners.add(cb)
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
  },
  // Any credentials work in demo mode
  async signInWithPassword(_creds: { email: string; password: string }) {
    session = makeSession()
    emit('SIGNED_IN')
    return { data: { user: demoUser, session }, error: null }
  },
  async signOut() {
    session = null
    emit('SIGNED_OUT')
    return { error: null }
  },
}

// ── Edge functions ──
const functions = {
  async invoke(name: string, opts?: { body?: any }) {
    await new Promise((r) => setTimeout(r, 300))
    if (name === 'generate-r2-upload-url') {
      const files: { name: string }[] = opts?.body?.files ?? []
      return {
        data: {
          urls: files.map((f) => ({ uploadUrl: 'demo://upload', url: 'demo://file', key: `attachments/demo-${crypto.randomUUID()}-${f.name}` })),
        },
        error: null,
      }
    }
    return { data: { success: true }, error: null }
  },
}

export const mockSupabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  functions,
}
