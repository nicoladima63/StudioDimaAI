import React from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface PushNotificationToggleProps {
  onError?: (error: string) => void
  onSuccess?: (message: string) => void
  showLabel?: boolean
  size?: 'sm' | 'lg'
}

const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({
  onError,
  onSuccess,
}) => {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications()

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe()
        onSuccess?.('Notifiche disattivate')
      } else {
        await subscribe()
        onSuccess?.('Notifiche attivate')
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Errore notifiche')
    }
  }

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <BellOff className="h-4 w-4" />
        <span className="text-sm">Non supportato</span>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <BellOff className="h-4 w-4" />
        <span className="text-sm">Permesso negato</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-foreground">
        {isLoading
          ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          : <Bell className="h-4 w-4" />
        }
        <span className="text-sm">Notifiche</span>
      </div>
      <Switch
        checked={isSubscribed}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-400"
      />
    </div>
  )
}

export default PushNotificationToggle
