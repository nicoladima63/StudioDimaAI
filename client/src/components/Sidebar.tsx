// src/components/Sidebar.tsx
import React from 'react'
import { CSidebar, CSidebarNav, CNavItem, CNavTitle } from '@coreui/react'
import { NavLink } from 'react-router-dom'
import { cilSpeedometer, cilCalendar, cilBell, cilUser, cilHome, cilSettings } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useEnvStore } from '@/store/authStore'

const Sidebar: React.FC = () => {
  const mode = useEnvStore((state) => state.mode)
  return (
    <CSidebar className="bg-light vh-100">
      <CSidebarNav>
        <CNavItem>
          <NavLink to="/" className="nav-link">
            <CIcon icon={cilSpeedometer} className="me-2" />Dashboard
          </NavLink>
        </CNavItem>
        <CNavTitle>Pagine</CNavTitle>
        <CNavItem>
          <NavLink to="/calendar" className="nav-link">
            <CIcon icon={cilCalendar} className="me-2" />Calendar
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/recalls" className="nav-link">
            <CIcon icon={cilBell} className="me-2" />Richiami
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/pazienti" className="nav-link">
            <CIcon icon={cilUser} className="me-2" />Pazienti
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/studio" className="nav-link">
            <CIcon icon={cilHome} className="me-2" />Studio
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/settings" className="nav-link">
            <CIcon icon={cilSettings} className="me-2" />Settings
          </NavLink>
        </CNavItem>
      </CSidebarNav>
    </CSidebar>
  )
}

export default Sidebar