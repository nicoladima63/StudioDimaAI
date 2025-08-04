// src/components/Sidebar.tsx
import React from 'react'
import { CSidebar, CSidebarNav, CNavItem, CNavTitle } from '@coreui/react'
import { NavLink, Link } from 'react-router-dom'
import { cilSpeedometer, cilCalendar, cilBell, cilUser,  cilSettings, cilCreditCard, cilList, cilEuro, cilDescription, cilMoney, cilPeople, cilChart } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useSidebarStore } from '@/store/useSidebarStore'
import "@/components/common/css/custom-css.css";

const Sidebar: React.FC = () => {
  const { visible, unfoldable, isMobile, setSidebarVisible } = useSidebarStore();
1
  // Handler per chiudere la sidebar quando si clicka su un link (solo mobile)
  const handleLinkClick = () => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  return (
    <CSidebar 
      className="bg-light vh-100 custom-sidebar"
      visible={visible}
      unfoldable={unfoldable}
      onVisibleChange={(visible) => {
        // Permetti a CoreUI di gestire la visibilità
        setSidebarVisible(visible);
      }}
    >
      <CSidebarNav>
        <CNavItem>
          <NavLink to="/" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilSpeedometer} className="me-2" />Dashboard
          </NavLink>
        </CNavItem>
        <CNavTitle>Pagine</CNavTitle>
        <CNavItem>
          <NavLink to="/recalls" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilBell} className="me-2" />Richiami
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/pazienti" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilUser} className="me-2" />Pazienti
          </NavLink>
        </CNavItem>
        <CNavTitle>Automazioni</CNavTitle>
        <CNavItem>
          <NavLink to="/calendar" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilCalendar} className="me-2" />Calendar
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/rentri" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilList} className="me-2" />RENTRI
          </NavLink>
        </CNavItem>
        <CNavTitle>Ricetta elettronica</CNavTitle>
        <CNavItem>
          <NavLink to="/ricetta" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilList} className="me-2" />NRE
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/ricetta/test" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilDescription} className="me-2" />Test Ricette
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/ricetta/setting" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilDescription} className="me-2" />Protocolli
          </NavLink>
        </CNavItem>
        <CNavTitle>Studio</CNavTitle>
        <CNavItem>
          <Link to="/incassi" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilEuro} className="me-2" />Incassi
          </Link>
        </CNavItem>
        <CNavItem>
          <NavLink to="/fatture" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilCreditCard} className="me-2" />Fatture
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/spese" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilMoney} className="me-2" />Spese
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/fornitori" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilPeople} className="me-2" />Fornitori
          </NavLink>
        </CNavItem>
        <CNavItem>
          <NavLink to="/kpi" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilChart} className="me-2" />KPI
          </NavLink>
        </CNavItem>

        <CNavTitle>Impostazioni</CNavTitle>
        <CNavItem>
          <NavLink to="/settings" className="nav-link" onClick={handleLinkClick}>
            <CIcon icon={cilSettings} className="me-2" />Settings
          </NavLink>
        </CNavItem>
      </CSidebarNav>
    </CSidebar>
  )
}

export default Sidebar