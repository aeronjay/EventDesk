import { supabase } from '../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

export default function Dashboard({ user }: { user: User }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20 }}>
      <h1>Dashboard</h1>
      <p>Logged in as: <strong>{user.email}</strong></p>
      <button onClick={handleLogout} style={{ padding: '8px 16px', marginTop: 12 }}>
        Logout
      </button>
    </div>
  )
}
