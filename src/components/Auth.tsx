import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowRight } from 'lucide-react'

function LogoMark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.45_0.2_350)] shadow-lg shadow-primary/30 ${className}`}>
      <span className="font-semibold text-primary-foreground">Q</span>
    </div>
  )
}

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Brand panel (desktop) ── */}
      <aside className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden bg-[oklch(0.22_0.05_350)] p-12 text-white lg:flex">
        {/* Glows */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary/50 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[26rem] w-[26rem] rounded-full bg-accent/30 blur-[120px]" />
        {/* Fine grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        <div className="relative flex items-center gap-3">
          <LogoMark className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">QSolicit</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            Every request,
            <br />
            <span className="bg-gradient-to-r from-[oklch(0.8_0.14_350)] to-accent bg-clip-text text-transparent">
              accounted for.
            </span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/60">
            Track incoming solicitations from the day they arrive to the day of the event.
          </p>
        </div>

        <p className="relative text-xs text-white/40">&copy; {new Date().getFullYear()} QSolicit</p>
      </aside>

      {/* ── Sign-in form ── */}
      <main className="relative flex flex-1 items-center justify-center px-6 py-12">
        {/* Soft glow behind the form on mobile */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-[100px] lg:hidden" />

        <div className="relative w-full max-w-sm">
          <LogoMark className="mb-10 h-11 w-11 text-lg lg:hidden" />

          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue to your workspace.</p>

          <form onSubmit={handleLogin} className="mt-10 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="auth-email" className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl bg-card px-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password" className="text-xs font-medium text-muted-foreground">
                Password
              </Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 rounded-xl bg-card px-4"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="group h-11 w-full gap-2 rounded-xl text-sm shadow-[0_10px_30px_-10px] shadow-primary/70"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-12 text-center text-xs text-muted-foreground lg:hidden">
            &copy; {new Date().getFullYear()} QSolicit
          </p>
        </div>
      </main>
    </div>
  )
}
