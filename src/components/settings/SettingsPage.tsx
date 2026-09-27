import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchUserSettings, updateUserSettings } from '@/lib/settings'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [receiveNotifications, setReceiveNotifications] = useState(true)

  useEffect(() => {
    async function loadSettings() {
      if (!user) return
      try {
        const settings = await fetchUserSettings(user.id)
        if (settings) {
          setReceiveNotifications(settings.receive_notifications)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await updateUserSettings(user.id, receiveNotifications)
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full mt-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Account Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account preferences and notifications.
        </p>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-medium">Email Notifications</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Configure how you want to be notified about upcoming solicitations.
          </p>
          
          <div className="flex items-center justify-between space-x-2">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="notifications-toggle" className="text-base">
                Solicitation Reminders
              </Label>
              <span className="text-sm text-muted-foreground">
                Receive an email reminder 5 days before, 1 day before, and on the exact date of your upcoming solicitations.
              </span>
            </div>
            <Switch
              id="notifications-toggle"
              checked={receiveNotifications}
              onCheckedChange={setReceiveNotifications}
            />
          </div>
        </div>
        <div className="flex items-center justify-end p-6 pt-0">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
