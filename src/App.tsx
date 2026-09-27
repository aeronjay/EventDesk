import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import SolicitationsPage from './components/solicitations/SolicitationsPage'
import AdminPage from './components/admin/AdminPage'
import SettingsPage from './components/settings/SettingsPage'

import DashboardOverview from './components/dashboard/DashboardOverview'

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
        <Route index element={<DashboardOverview />} />
        <Route path="solicits" element={<SolicitationsPage key="solicits" showHistory={false} />} />
        <Route
          path="history"
          element={<SolicitationsPage key="history" showHistory={true} />}
        />
        <Route path="settings" element={<SettingsPage />} />
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
