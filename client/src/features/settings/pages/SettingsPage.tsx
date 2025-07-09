import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { CFormSwitch, CButton, CToast, CToastBody, CToaster, CRow, CCol,CCard,CCardBody, CFormLabel } from '@coreui/react';
import { useEnvStore } from '@/features/auth/store/useAuthStore';
import { setApiMode, getApiMode, getAppointmentsWithModeWarning, trySwitchToProd, setRentriMode as apiSetRentriMode, setRicettaMode as apiSetRicettaMode } from '@/api/apiClient';

const SettingsPage: React.FC = () => {
  const mode = useEnvStore((state) => state.mode);
  const setMode = useEnvStore((state) => state.setMode);
  const rentriMode = useEnvStore((state) => state.rentriMode);
  const setRentriMode = useEnvStore((state) => state.setRentriMode);
  const ricettaMode = useEnvStore((state) => state.ricettaMode);
  const setRicettaMode = useEnvStore((state) => state.setRicettaMode);
  const [selectedMode, setSelectedMode] = useState<'dev' | 'prod'>(mode);
  const [selectedRentriMode, setSelectedRentriMode] = useState<'dev' | 'prod'>(rentriMode);
  const [selectedRicettaMode, setSelectedRicettaMode] = useState<'dev' | 'prod'>(ricettaMode);
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

  const handleApplyRentri = async () => {
    try {
      const res = await apiSetRentriMode(selectedRentriMode);
      if (!res.success) return;
      setRentriMode(selectedRentriMode);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 3000);
    }
  };

  const handleApplyRicetta = async () => {
    try {
      const res = await apiSetRicettaMode(selectedRicettaMode);
      if (!res.success) return;
      setRicettaMode(selectedRicettaMode);
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
    <Card title="Impostazioni">
        <CRow className="mt-4">
          {/*Prima colonna */}
          <CCol md={4}>
            <CCard>
              <CCardBody>
                <div className="d-flex align-items-center justify-content-evenly mb-3 w-100">
                  <CFormLabel className="fw-semibold mb-0">DATABASE</CFormLabel>
                  <CFormSwitch
                    id="mode-switch"
                    label={selectedMode === 'prod' ? 'Studio' : 'Casa'}
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
              </CCardBody>
            </CCard>
          </CCol>

          {/*Seconda colonna: RENTRI */}
          <CCol md={4}>
            <CCard>
              <CCardBody>
                <div className="d-flex align-items-center justify-content-evenly mb-3">
                  <CFormLabel className="fw-semibold mb-0">RENTRI</CFormLabel>
                  <CFormSwitch
                      id="rentri-mode-switch"
                      label={selectedRentriMode === 'prod' ? 'Prod' : 'Test'}
                      checked={selectedRentriMode === 'prod'}
                      onChange={() => setSelectedRentriMode(selectedRentriMode === 'prod' ? 'dev' : 'prod')}
                      color={selectedRentriMode === 'prod' ? 'success' : 'primary'}
                    />
                    <CButton
                      color="primary"
                      size="sm"
                      disabled={selectedRentriMode === rentriMode}
                      onClick={handleApplyRentri}
                    >
                      Applica
                    </CButton>
                </div>
              </CCardBody>
            </CCard>
          </CCol>

          {/*Terza colonna: Ricetta Elettronica */}
          <CCol md={4}>
            <CCard>
              <CCardBody>
                <div className="d-flex align-items-center justify-content-evenly mb-3">
                  <CFormLabel className="fw-semibold mb-0">RNE</CFormLabel>
                  <CFormSwitch
                      id="ricetta-mode-switch"
                      label={selectedRicettaMode === 'prod' ? 'Prod' : 'Test'}
                      checked={selectedRicettaMode === 'prod'}
                      onChange={() => setSelectedRicettaMode(selectedRicettaMode === 'prod' ? 'dev' : 'prod')}
                      color={selectedRicettaMode === 'prod' ? 'success' : 'primary'}
                    />
                    <CButton
                      color="primary"
                      size="sm"
                      disabled={selectedRicettaMode === ricettaMode}
                      onClick={handleApplyRicetta}
                    >
                      Applica
                    </CButton>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

      <CToaster placement="top-end">
        {showToast && toast}
        {errorToast && error}
        {modeWarning && (
          <CToast autohide visible color="warning" key="mode-warning">
            <CToastBody>{modeWarning}</CToastBody>
          </CToast>
        )}
      </CToaster>
    </Card>
  );
};

export default SettingsPage; 