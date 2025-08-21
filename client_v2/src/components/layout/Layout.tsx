import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

// Layout con hamburger menu
const Layout: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = React.useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActivePage = (path: string) => location.pathname === path

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar Test */}
      <div style={{ 
        width: sidebarVisible ? '250px' : '0px', 
        backgroundColor: '#2c3e50', 
        color: 'white',
        padding: sidebarVisible ? '20px' : '0px',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}>
        <h3>Studio Dima V2</h3>
        <div style={{ marginTop: '20px' }}>
          <div 
            style={{ 
              padding: '10px', 
              borderBottom: '1px solid #34495e', 
              cursor: 'pointer',
              backgroundColor: isActivePage('/dashboard') ? '#34495e' : 'transparent'
            }}
            onClick={() => navigate('/dashboard')}
          >
            📊 Dashboard
          </div>
          <div style={{ padding: '10px', borderBottom: '1px solid #34495e', cursor: 'pointer' }}>👥 Fornitori</div>
          <div 
            style={{ 
              padding: '10px', 
              borderBottom: '1px solid #34495e', 
              cursor: 'pointer',
              backgroundColor: isActivePage('/materiali') ? '#34495e' : 'transparent'
            }}
            onClick={() => navigate('/materiali')}
          >
            📦 Materiali
          </div>
          <div style={{ padding: '10px', borderBottom: '1px solid #34495e', cursor: 'pointer' }}>💰 Spese</div>
          <div style={{ padding: '10px', borderBottom: '1px solid #34495e', cursor: 'pointer' }}>📈 Statistiche</div>
          <div style={{ padding: '10px', borderBottom: '1px solid #34495e', cursor: 'pointer' }}>⚙️ Impostazioni</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
        {/* Header con hamburger */}
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
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    fontWeight: '500'
                  }}>
                    👤 {user.name || user.username}
                  </span>
                  <span style={{ 
                    background: user.role === 'admin' ? '#28a745' : '#007bff', 
                    color: 'white',
                    padding: '2px 6px', 
                    borderRadius: '3px',
                    fontSize: '12px',
                    textTransform: 'uppercase'
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
                    fontSize: '14px',
                    fontWeight: '500'
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
        <main style={{ padding: '20px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout