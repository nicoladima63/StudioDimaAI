// src/components/Sidebar.tsx
import React from 'react'
import { CSidebar, CSidebarNav, CNavItem, CNavTitle } from '@coreui/react'
import { NavLink } from 'react-router-dom'

const Sidebar: React.FC = () => {
  return (
    <CSidebar className="bg-light vh-100">
      <CSidebarNav>
        <CNavTitle>Menu</CNavTitle>
        <CNavItem>
          <NavLink to="/" className="nav-link">
            Dashboard
          </NavLink>
        </CNavItem>
        <CNavTitle>Moduli</CNavTitle>
        <CNavItem>
          <NavLink to="/calendar" className="nav-link">
            Calendar
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/recalls" className="nav-link">
            Richiami
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/pazienti" className="nav-link">
            Pazienti
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/studio" className="nav-link">
            Studio
          </NavLink>
        </CNavItem>
      </CSidebarNav>
    </CSidebar>
  )
}

export default Sidebar