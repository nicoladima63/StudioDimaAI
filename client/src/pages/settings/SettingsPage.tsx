import React, { useState } from 'react';
import DashboardCard from '@/components/DashboardCard';
import { CFormSwitch, CButton, CToast, CToastBody, CToaster } from '@coreui/react';
import { useEnvStore } from '@/store/authStore';

const SettingsPage: React.FC = () => {
  const mode = useEnvStore((state) => state.mode);
  const setMode = useEnvStore((state) => state.setMode);
  const [selectedMode, setSelectedMode] = useState<'dev' | 'prod'>(mode);
  const [showToast, setShowToast] = useState(false);

  const handleApply = () => {
    setMode(selectedMode);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const toast = (
    <CToast autohide visible color="success" key="toast">
      <CToastBody>Modalità aggiornata con successo!</CToastBody>
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
      </CToaster>
    </DashboardCard>
  );
};

export default SettingsPage; 