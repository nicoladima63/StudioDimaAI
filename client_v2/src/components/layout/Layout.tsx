import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSun, cilMoon } from '@coreui/icons'
import { useAuthStore } from '@/store/auth.store'
import AppSidebar from './AppSidebar'
import NotificationBell from '@/components/ui/NotificationBell'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import { useTheme } from '@/hooks/useTheme'

const Layout: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = React.useState(true)
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div>
      <AppSidebar
        visible={sidebarVisible}
        onVisibleChange={setSidebarVisible}
      />
      <div
        className="wrapper d-flex flex-column min-vh-100"
        style={{
          marginLeft: sidebarVisible ? '256px' : '0',
          transition: 'margin-left 0.15s ease-in-out',
        }}
      >
        <header style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--cui-border-color)',
          backgroundColor: 'var(--cui-body-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setSidebarVisible(!sidebarVisible)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '8px',
                marginRight: '15px',
                borderRadius: '4px',
                color: 'var(--cui-body-color)',
              }}
              title={sidebarVisible ? 'Nascondi menu' : 'Mostra menu'}
            >
              ☰
            </button>
            <h2 style={{ margin: 0, color: 'var(--cui-body-color)', fontSize: '1.25rem' }}>
              Studio Dima Dashboard V2
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

            {/* Toggle tema */}
            <CButton
              color="secondary"
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
            >
              <CIcon icon={theme === 'dark' ? cilSun : cilMoon} size="sm" />
            </CButton>

            {isAuthenticated && user ? (
              <>
                <PushNotificationToggle
                  showLabel={false}
                  size="sm"
                  onSuccess={() => {}}
                  onError={() => {}}
                />
                <NotificationBell />

                <span className="badge text-bg-secondary" style={{ fontSize: '12px', padding: '6px 8px' }}>
                  {user.username}
                </span>
                <span
                  className={`badge text-bg-${user.role === 'admin' ? 'success' : 'primary'}`}
                  style={{ fontSize: '12px', padding: '6px 8px' }}
                >
                  {user.role}
                </span>
                <CButton color="danger" size="sm" onClick={handleLogout}>
                  Esci
                </CButton>
              </>
            ) : (
              <span className="text-muted small fst-italic">Non autenticato</span>
            )}
          </div>
        </header>

        <div className="body flex-grow-1">
          <main className="container-fluid p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export default Layout
