import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import AppSidebar from './AppSidebar'

// Layout CoreUI con AppSidebar moderna
const Layout: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = React.useState(true)
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()

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
          transition: 'margin-left 0.15s ease-in-out'
        }}
      >
        {/* Header con auth */}
        <header style={{ 
          padding: '15px 20px', 
          borderBottom: '1px solid #dee2e6',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
                color: '#2c3e50'
              }}
              title={sidebarVisible ? 'Nascondi menu' : 'Mostra menu'}
            >
              ☰
            </button>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>Studio Dima Dashboard V2</h2>
          </div>

          {/* Auth section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {isAuthenticated && user ? (
              <>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  <span style={{ 
                    background: '#e9ecef', 
                    padding: '6px 8px', 
                    borderRadius: '4px',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: '32px',
                    fontSize: '12px'
                  }}>
                    👤 {user.name || user.username}
                  </span>
                  <span style={{ 
                    background: user.role === 'admin' ? '#28a745' : '#007bff', 
                    color: 'white',
                    padding: '6px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: '32px'
                  }}>
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: '32px'
                  }}
                  title="Logout"
                >
                  Esci
                </button>
              </>
            ) : (
              <div style={{ 
                color: '#6c757d',
                fontSize: '14px',
                fontStyle: 'italic'
              }}>
                Non autenticato
              </div>
            )}
          </div>
        </header>
        
        {/* Content area */}
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