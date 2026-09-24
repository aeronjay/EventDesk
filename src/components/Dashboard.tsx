import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  FileText,
  Clock,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  path: string
  superAdminOnly?: boolean
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'solicits', label: 'Solicits', icon: FileText, path: '/solicits' },
  { id: 'history', label: 'History', icon: Clock, path: '/history' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  { id: 'admin', label: 'Admin', icon: Shield, path: '/admin', superAdminOnly: true },
]

export default function Dashboard() {
  const { user, isSuperAdmin, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const visibleNavItems = navItems.filter(
    (item) => !item.superAdminOnly || isSuperAdmin
  )

  // Find active nav by path
  const activeItem = visibleNavItems.find((item) => {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  })

  const handleNav = (item: NavItem) => {
    navigate(item.path)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-3 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <span className="text-sm font-bold text-primary-foreground">Q</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            QSolicit
          </span>
          {/* Close button — mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem?.id === item.id
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleNav(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon size={18} />
                {item.label}
                {item.superAdminOnly && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider opacity-60">
                    Admin
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2 px-3">
            <span className="truncate text-xs text-muted-foreground flex-1">
              {user?.email}
            </span>
            {isSuperAdmin && (
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                Super
              </span>
            )}
          </div>
          <Button
            id="btn-logout"
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="shrink-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:px-6">
          <button
            id="btn-mobile-menu"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-base font-semibold text-foreground">
            {activeItem?.label ?? 'QSolicit'}
          </h1>
        </header>

        {/* Page body — rendered by router */}
        <main className="flex flex-1 flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
