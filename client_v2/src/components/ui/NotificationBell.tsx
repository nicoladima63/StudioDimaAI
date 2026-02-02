import React, { useEffect, useRef } from 'react'
import { CDropdown, CDropdownToggle, CDropdownMenu, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell } from '@coreui/icons'
import { useNotificationStore } from '@/store/notifications.store'
import NotificationCenter from './NotificationCenter'

const POLLING_INTERVAL = 30000 // 30 seconds

const NotificationBell: React.FC = () => {
  const { unreadCount, fetchUnread } = useNotificationStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [hasError, setHasError] = React.useState(false)

  // Initial fetch
  useEffect(() => {
    fetchUnread().catch((err) => {
      // Silent fail, component should still render
      setHasError(true)
    })
  }, [fetchUnread])

  // Setup polling
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchUnread().catch((err) => {
        // Silent fail, will retry on next interval
      })
    }, POLLING_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchUnread])

  // Fallback render if icon fails
  if (!cilBell) {
    return <div style={{ color: 'red' }}>🔔</div>
  }

  return (
    <CDropdown variant="nav-item" placement="bottom-end">
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
