import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CNavLink,
  CNavItem,
  CButton,
  CBadge,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilMenu, cilContrast, cilMoon, cilSun } from '@coreui/icons';
import { useSidebarStore } from '@/store/useSidebarStore';
import { useAuthStore, useEnvStore } from '@/features/auth/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { setMode as apiSetMode } from '@/api/services/settings.service';
import { useState } from 'react';
import { CToast, CToastBody, CToaster } from '@coreui/react';

const AppHeader: React.FC = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Sidebar state
  const { visible, toggleSidebar } = useSidebarStore();
  
  // Auth state
  const { token, clearToken, username } = useAuthStore();
  const navigate = useNavigate();
  
  // Environment modes
  const dbmode = useEnvStore((state) => state.mode);
  const rentriMode = useEnvStore((state) => state.rentriMode);
  const ricettaMode = useEnvStore((state) => state.ricettaMode);
  const { setMode, setRentriMode, setRicettaMode } = useEnvStore.getState();

  const [errorToast, setErrorToast] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // Shadow effect on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        headerRef.current.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0);
      }
    };

    document.addEventListener('scroll', handleScroll);
    return () => document.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  const handleDbBadgeClick = async () => {
    try {
      const newMode = (dbmode === 'prod' ? 'dev' : 'prod') as 'dev' | 'prod';
      await apiSetMode('database', newMode);
      setMode(newMode);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 1500);
    } catch {
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 2000);
    }
  };

  const handleRentriBadgeClick = async () => {
    try {
      const newMode = (rentriMode === 'prod' ? 'dev' : 'prod') as 'dev' | 'prod';
      await apiSetMode('rentri', newMode);
      setRentriMode(newMode);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 1500);
    } catch {
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 2000);
    }
  };

  const handleRicettaBadgeClick = async () => {
    try {
      const newMode = (ricettaMode === 'prod' ? 'dev' : 'prod') as 'dev' | 'prod';
      await apiSetMode('ricetta', newMode);
      setRicettaMode(newMode);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 1500);
    } catch {
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 2000);
    }
  };

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4 py-3" fluid style={{ minHeight: '77px' }}>
        {/* Sidebar Toggle */}
        <CHeaderToggler
          onClick={toggleSidebar}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

        {/* Navigation Links - Desktop */}
        <CHeaderNav className="d-none d-md-flex">
          <CNavItem>
            <CNavLink to="/" as={NavLink}>Dashboard</CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink to="/pazienti" as={NavLink}>Pazienti</CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink to="/kpi" as={NavLink}>KPI</CNavLink>
          </CNavItem>
        </CHeaderNav>

        {/* Right Side - Mode Badges and User */}
        <CHeaderNav className="ms-auto">
          {/* Mode Badges */}
          <div className="d-flex align-items-center gap-3 me-3">
            <span className="fw-semibold small">DB</span>
            <CBadge
              color={dbmode === 'prod' ? 'success' : 'warning'}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Cambia modalità DB"
              onClick={handleDbBadgeClick}
              role="button"
              tabIndex={0}
            >
              {dbmode === 'prod' ? 'Studio' : 'Casa'}
            </CBadge>
            
            <span className="vr mx-2" style={{ height: 20 }} />
            
            <span className="fw-semibold small">RENTRI</span>
            <CBadge
              color={rentriMode === 'prod' ? 'success' : 'warning'}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Cambia modalità RENTRI"
              onClick={handleRentriBadgeClick}
              role="button"
              tabIndex={0}
            >
              {rentriMode === 'prod' ? 'Prod' : 'Test'}
            </CBadge>
            
            <span className="vr mx-2" style={{ height: 20 }} />
            
            <span className="fw-semibold small">RNE</span>
            <CBadge
              color={ricettaMode === 'prod' ? 'success' : 'warning'}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Cambia modalità RNE"
              onClick={handleRicettaBadgeClick}
              role="button"
              tabIndex={0}
            >
              {ricettaMode === 'prod' ? 'Prod' : 'Test'}
            </CBadge>
          </div>

          {/* User Menu */}
          {token && (
            <div className="d-flex align-items-center gap-3">
              <span className="text-muted small">Ciao {username}</span>
              <CButton color="danger" size="sm" onClick={handleLogout}>
                Logout
              </CButton>
            </div>
          )}
        </CHeaderNav>
      </CContainer>

      {/* Toast Notifications */}
      <CToaster placement="top-end">
        {successToast && (
          <CToast autohide visible color="success" key="toast">
            <CToastBody>Modalità aggiornata con successo!</CToastBody>
          </CToast>
        )}
        {errorToast && (
          <CToast autohide visible color="danger" key="error-toast">
            <CToastBody>Errore nel cambio modalità!</CToastBody>
          </CToast>
        )}
      </CToaster>
    </CHeader>
  );
};

export default AppHeader;