
// src/components/Navbar.tsx
import React from 'react'
import { CNavbar, CContainer, CNavbarBrand, CButton } from '@coreui/react'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'

const Navbar: React.FC = () => {
  const { token, clearToken, username } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <CNavbar colorScheme="light" className="bg-light">
      <CContainer fluid>
        <CNavbarBrand href="/">Studio Di Martino</CNavbarBrand>
        {token && (
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted">Ciao {username}</span>
            <CButton color="danger" size="sm" onClick={handleLogout}>
              Logout
            </CButton>
          </div>
        )}
      </CContainer>
    </CNavbar>
  )
}

export default Navbar