import { useState, useEffect } from 'react'
import { TERMS } from '@/lib/appName'
import { useAuth } from '@/contexts/AuthContext'
import { fetchUserSettings, updateUserSettings } from '@/lib/settings'
import { getAppSetting, setAppSetting } from '@/lib/telegram'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'

export default function SettingsPage() {
  const { user, isSuperAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [receiveNotifications, setReceiveNotifications] = useState(true)

  // Telegram settings
  const [telegramChatId, setTelegramChatId] = useState('')
  const [savingTelegram, setSavingTelegram] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      if (!user) return
      try {
        const [settings, chatId] = await Promise.all([
          fetchUserSettings(user.id),
          isSuperAdmin ? getAppSetting('telegram_chat_id') : Promise.resolve(null),
        ])
        if (settings) {
          setReceiveNotifications(settings.receive_notifications)
        }
        if (chatId) {
          setTelegramChatId(chatId)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [user, isSuperAdmin])

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

  const handleSaveTelegram = async () => {
    setSavingTelegram(true)
    try {
      await setAppSetting('telegram_chat_id', telegramChatId.trim())
      toast.success('Telegram Chat ID saved successfully')
    } catch (error) {
      console.error('Failed to save Telegram settings:', error)
      toast.error('Failed to save Telegram settings')
    } finally {
      setSavingTelegram(false)
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
            Configure how you want to be notified about upcoming {TERMS.many}.
          </p>
          
          <div className="flex items-center justify-between space-x-2">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="notifications-toggle" className="text-base">
                {TERMS.One} Reminders
              </Label>
              <span className="text-sm text-muted-foreground">
                Receive an email reminder 5 days before, 1 day before, and on the exact date of your upcoming {TERMS.many}.
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

      {/* Telegram Integration — only visible to superadmins */}
      {isSuperAdmin && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-medium">Telegram Integration</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Configure the Telegram group chat where {TERMS.one} details will be sent. 
              Use the "Send to Telegram" button in any {TERMS.one}'s detail view.
            </p>

            <div className="space-y-3">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="telegram-chat-id" className="text-base">
                  Chat ID
                </Label>
                <span className="text-sm text-muted-foreground">
                  The Telegram group chat ID where the bot will send messages. Typically a negative number (e.g. -5450676224).
                </span>
                <Input
                  id="telegram-chat-id"
                  type="text"
                  placeholder="e.g. -5450676224"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="max-w-sm font-mono"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end p-6 pt-0">
            <Button onClick={handleSaveTelegram} disabled={savingTelegram || !telegramChatId.trim()}>
              {savingTelegram && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Telegram Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
