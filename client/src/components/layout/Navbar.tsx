// src/components/Navbar.tsx
import React from 'react'
import { CNavbar, CContainer, CNavbarBrand, CButton, CBadge } from '@coreui/react'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { useEnvStore } from '@/store/authStore'

const Navbar: React.FC = () => {
  const { token, clearToken, username } = useAuthStore()
  const navigate = useNavigate()
  const mode = useEnvStore((state) => state.mode)

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <CNavbar colorScheme="light" className="bg-light">
      <CContainer fluid>
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="d-flex align-items-center">
            <CNavbarBrand href="/" className="mb-0">
              Studio Di Martino
            </CNavbarBrand>
            <CBadge
              color={mode === 'prod' ? 'success' : 'primary'}
              className="fw-normal ms-2"
              style={{ fontWeight: 400, fontSize: '1rem' }}
            >
              {mode === 'prod' ? 'Prod' : 'Dev'}
            </CBadge>
          </div>
          {token && (
            <div className="d-flex align-items-center gap-3">
              <span className="text-muted">Ciao {username}</span>
              <CButton color="danger" size="sm" onClick={handleLogout}>
                Logout
              </CButton>
            </div>
          )}
        </div>
      </CContainer>
    </CNavbar>
  )
}

export default Navbar