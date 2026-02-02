import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CListGroup, CListGroupItem, CSpinner, CBadge, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilWarning, cilInfo, cilX } from '@coreui/icons'
import { useNotificationStore } from '@/store/notifications.store'
import type { Notification } from '@/types'

const NotificationCenter: React.FC = () => {
  const navigate = useNavigate()
  const { notifications, loading, error, markAsRead, markAllAsRead } = useNotificationStore()

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return cilCheckCircle
      case 'warning':
        return cilWarning
      case 'error':
        return cilX
      case 'info':
      default:
        return cilInfo
    }
  }

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'success'
      case 'warning':
        return 'warning'
      case 'error':
        return 'danger'
      case 'info':
      default:
        return 'info'
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark as read - notification will disappear from list
      await markAsRead(notification.id)

      // Navigate if link exists (in a new navigation, not closing dropdown)
      if (notification.link) {
        // Small delay to show the notification disappearing
        setTimeout(() => {
          navigate(notification.link!)
        }, 300)
      }
    } catch (err) {
      // Error already handled in store
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead()
    } catch (err) {
      // Error already handled in store
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Ora'
    if (minutes < 60) return `${minutes}m fa`
    if (hours < 24) return `${hours}h fa`
    if (days < 7) return `${days}g fa`
    return date.toLocaleDateString('it-IT')
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
        <h6 className="mb-0">Notifiche</h6>
        {notifications.length > 0 && (
          <CButton
            color="link"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-decoration-none"
          >
            Segna tutte lette
          </CButton>
        )}
      </div>

      {loading === 'loading' && (
        <div className="text-center p-4">
          <CSpinner size="sm" />
        </div>
      )}

      {error && (
        <div className="p-3 text-danger">
          <small>{error}</small>
        </div>
      )}

      {loading !== 'loading' && notifications.length === 0 && (
        <div className="text-center p-4 text-muted">
          <CIcon icon={cilCheckCircle} size="xl" className="mb-2" />
          <p className="mb-0">Nessuna notifica</p>
        </div>
      )}

      {notifications.length > 0 && (
        <CListGroup flush>
          {notifications.map((notification) => (
            <CListGroupItem
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className="d-flex align-items-start text-start border-0"
              style={{ cursor: 'pointer' }}
            >
              <div className="me-2">
                <CIcon
                  icon={getNotificationIcon(notification.type)}
                  className={`text-${getNotificationColor(notification.type)}`}
                />
              </div>
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="d-flex justify-content-between align-items-start mb-1">
                  <small className="text-muted">{formatTimestamp(notification.created_at)}</small>
                  <CBadge color={getNotificationColor(notification.type)} size="sm">
                    {notification.type}
                  </CBadge>
                </div>
                <div className="fw-normal" style={{ fontSize: '0.9rem' }}>
                  {notification.message}
                </div>
              </div>
            </CListGroupItem>
          ))}
        </CListGroup>
      )}
    </div>
  )
}

export default NotificationCenter
