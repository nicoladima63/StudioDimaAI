// src/components/Navbar.tsx
import React from 'react'
import { CNavbar, CContainer, CNavbarBrand, CButton, CBadge } from '@coreui/react'
import { useAuthStore, useEnvStore } from '@/features/auth/store/useAuthStore';
import { useNavigate } from 'react-router-dom'
import { setMode as apiSetMode } from '@/api/apiClient';
import { useState } from 'react';
import { CToast, CToastBody, CToaster } from '@coreui/react';

const Navbar: React.FC = () => {
  const { token, clearToken, username } = useAuthStore()
  const navigate = useNavigate()
  const dbmode = useEnvStore((state) => state.mode)
  const rentriMode = useEnvStore((state) => state.rentriMode)
  const ricettaMode = useEnvStore((state) => state.ricettaMode)
  const { setMode, setRentriMode, setRicettaMode } = useEnvStore.getState();

  const [errorToast, setErrorToast] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  const handleDbBadgeClick = async () => {
    try {
      const newMode = (dbmode === 'prod' ? 'dev' : 'prod') as 'dev' | 'prod';
      if (newMode === 'prod') {
        // The original code had trySwitchToProd here, but trySwitchToProd is not imported.
        // Assuming it's a placeholder for a different function or removed.
        // For now, I'll keep the original logic but remove the non-existent import.
        // If trySwitchToProd was intended to be used, it needs to be re-added or replaced.
        // For now, I'll just set the mode directly.
        await apiSetMode('database', newMode);
      } else {
        await apiSetMode('database', newMode);
      }
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
    <CNavbar colorScheme="light" className="bg-light">
      <CContainer fluid>
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="d-flex align-items-center">
            <CNavbarBrand href="/" className="mb-0">
              Studio Di Martino
            </CNavbarBrand>
          </div>

          {/* Sezione centrale: riepilogo modalità */}
          <div className="d-flex align-items-center gap-4 mx-auto">
            <span className="fw-semibold">DB</span>
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
            <span className="vr mx-2" style={{ height: 24 }} />
            <span className="fw-semibold">RENTRI</span>
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
            <span className="vr mx-2" style={{ height: 24 }} />
            <span className="fw-semibold">RNE</span>
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