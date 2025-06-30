import React, { useState, useEffect } from 'react';
import DashboardCard from '@/components/DashboardCard';
import { CFormSwitch, CButton, CToast, CToastBody, CToaster } from '@coreui/react';
import { useEnvStore } from '@/store/authStore';
import { setApiMode, getApiMode, getAppointmentsWithModeWarning, trySwitchToProd } from '@/api/apiClient';

const SettingsPage: React.FC = () => {
  const mode = useEnvStore((state) => state.mode);
  const setMode = useEnvStore((state) => state.setMode);
  const [selectedMode, setSelectedMode] = useState<'dev' | 'prod'>(mode);
  const [showToast, setShowToast] = useState(false);
  const [errorToast, setErrorToast] = useState(false);
  const [modeWarning, setModeWarning] = useState<string | null>(null);

  useEffect(() => {
    getApiMode().then((backendMode) => {
      setSelectedMode(backendMode);
      setMode(backendMode);
    });
    checkAppointments();
  }, []);

  const handleApply = async () => {
    try {
      if (selectedMode === 'prod') {
        const res = await trySwitchToProd();
        if (!res.success) return;
        setMode('prod');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        return;
      }
      await setApiMode(selectedMode);
      setMode(selectedMode);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 3000);
    }
  };

  const checkAppointments = async () => {
    const now = new Date();
    const res = await getAppointmentsWithModeWarning(now.getMonth() + 1, now.getFullYear());
    if (res.modeChanged && res.modeWarning) {
      setModeWarning(res.modeWarning);
      setTimeout(() => setModeWarning(null), 5000);
    }
  };

  const toast = (
    <CToast autohide visible color="success" key="toast">
      <CToastBody>Modalità aggiornata con successo!</CToastBody>
    </CToast>
  );
  const error = (
    <CToast autohide visible color="danger" key="error-toast">
      <CToastBody>Errore nel cambio modalità!</CToastBody>
    </CToast>
  );

  return (
    <DashboardCard title="Impostazioni">
      <div className="d-flex align-items-center justify-content-evenly mb-3">
        <span className="fw-semibold">Modalità API</span>
        <div className="d-flex align-items-center gap-2">
          <CFormSwitch
            id="mode-switch"
            label={selectedMode === 'prod' ? 'Produzione' : 'Sviluppo'}
            checked={selectedMode === 'prod'}
            onChange={() => setSelectedMode(selectedMode === 'prod' ? 'dev' : 'prod')}
            color={selectedMode === 'prod' ? 'success' : 'primary'}
          />
          <CButton
            color="primary"
            size="sm"
            disabled={selectedMode === mode}
            onClick={handleApply}
          >
            Applica
          </CButton>
        </div>
      </div>
      <CToaster placement="top-end">
        {showToast && toast}
        {errorToast && error}
        {modeWarning && (
          <CToast autohide visible color="warning" key="mode-warning">
            <CToastBody>{modeWarning}</CToastBody>
          </CToast>
        )}
      </CToaster>
    </DashboardCard>
  );
};

export default SettingsPage; 