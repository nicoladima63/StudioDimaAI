import React, { useEffect, useRef } from 'react'
import { CDropdown, CDropdownToggle, CDropdownMenu, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell } from '@coreui/icons'
import { useNotificationStore } from '@/store/notifications.store'
import NotificationCenter from './NotificationCenter'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { useAuthStore } from '@/store/auth.store'

const POLLING_INTERVAL = 60000 // 60 seconds (reduced, WebSocket is primary)

const NotificationBell: React.FC = () => {
  const { unreadCount, fetchUnread } = useNotificationStore()
  const { isAuthenticated } = useAuthStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [hasError, setHasError] = React.useState(false)

  // Enable real-time notifications via WebSocket
  const { isConnected } = useRealtimeNotifications()

  // Initial fetch
  useEffect(() => {
    if (!isAuthenticated) return
    fetchUnread().catch(() => {
      setHasError(true)
    })
  }, [fetchUnread, isAuthenticated])

  // Setup polling as fallback (reduced frequency since WebSocket is primary)
  // Polling runs only when authenticated - avoids "Missing Authorization Header" spam in logs
  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      fetchUnread().catch(() => {
        // Silent fail, will retry on next interval
      })
    }, POLLING_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchUnread, isAuthenticated])

  // Fallback render if icon fails
  if (!cilBell) {
    return <div style={{ color: 'red' }}>🔔</div>
  }

  return (
    <CDropdown variant="nav-item" placement="bottom-end" style={{ listStyle: 'none' }}>
      <CDropdownToggle
        className="py-0 pe-0"
        caret={false}
        style={{ border: 'none', background: 'transparent', padding: '8px' }}
      >
        <div className="position-relative d-inline-block" style={{ cursor: 'pointer' }}>
          <CIcon icon={cilBell} size="xl" />
          {unreadCount > 0 && (
            <CBadge
              color="danger"
              position="top-end"
              shape="rounded-pill"
              className="position-absolute"
              style={{
                top: '-2px',
                right: '-8px',
                fontSize: '0.75rem',
                padding: '0.35em 0.6em',
                minWidth: '20px',
                fontWeight: 'bold'
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </CBadge>
          )}
        </div>
      </CDropdownToggle>

      <CDropdownMenu style={{ width: '350px', maxHeight: '500px' }}>
        <NotificationCenter />
      </CDropdownMenu>
    </CDropdown>
  )
}

export default NotificationBell
