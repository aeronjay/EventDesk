import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import SolicitationsPage from './components/solicitations/SolicitationsPage'
import AdminPage from './components/admin/AdminPage'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth />
  }

  return (
    <Routes>
      <Route element={<Dashboard />}>
        <Route
          index
          element={
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl font-bold text-primary">Q</span>
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Welcome to QSolicit</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Navigate to <strong>Solicits</strong> to manage your solicitation records.
                </p>
              </div>
            </div>
          }
        />
        <Route path="solicits" element={<SolicitationsPage key="solicits" showHistory={false} />} />
        <Route
          path="history"
          element={<SolicitationsPage key="history" showHistory={true} />}
        />
        <Route
          path="settings"
          element={
            <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
              Settings — coming soon
            </div>
          }
        />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="bottom-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
