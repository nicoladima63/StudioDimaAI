// src/components/Sidebar.tsx
import React from 'react'
import { CSidebar, CSidebarNav, CNavItem, CNavTitle } from '@coreui/react'
import { NavLink, Link } from 'react-router-dom'
import { cilSpeedometer, cilCalendar, cilBell, cilUser, cilHome, cilSettings, cilCreditCard, cilList, cilEuro } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import '../components/css/custom-css.css'

const Sidebar: React.FC = () => {
  return (
    <CSidebar className="bg-light vh-100 custom-sidebar">
      <CSidebarNav>
        <CNavItem>
          <NavLink to="/" className="nav-link">
            <CIcon icon={cilSpeedometer} className="me-2" />Dashboard
          </NavLink>
        </CNavItem>
        <CNavTitle>Pagine</CNavTitle>
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
          <NavLink to="/fatture" className="nav-link">
            <CIcon icon={cilCreditCard} className="me-2" />Fatture
          </NavLink>
        </CNavItem>
        <CNavItem>
          <Link to="/incassi" className="nav-link">
            <CIcon icon={cilEuro} className="me-2" />Incassi
          </Link>
        </CNavItem>
        <CNavTitle>Automazioni</CNavTitle>
        <CNavItem>
          <NavLink to="/calendar" className="nav-link">
            <CIcon icon={cilCalendar} className="me-2" />Calendar
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/ricetta" className="nav-link">
            <CIcon icon={cilList} className="me-2" />NRE
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/rentri" className="nav-link">
            <CIcon icon={cilList} className="me-2" />RENTRI
          </NavLink>
        </CNavItem>
        <CNavTitle>Impostazioni</CNavTitle>
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