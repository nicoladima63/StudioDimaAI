import React from 'react'
import { Outlet } from 'react-router-dom'

// Layout con hamburger menu
const Layout: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = React.useState(true)

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
          <div style={{ padding: '10px', borderBottom: '1px solid #34495e', cursor: 'pointer' }}>📊 Dashboard</div>
          <div style={{ padding: '10px', borderBottom: '1px solid #34495e', cursor: 'pointer' }}>👥 Fornitori</div>
          <div style={{ padding: '10px', borderBottom: '1px solid #34495e', cursor: 'pointer' }}>📦 Materiali</div>
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
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
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