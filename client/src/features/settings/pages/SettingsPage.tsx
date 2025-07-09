import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { CFormSwitch, CButton, CToast, CToastBody, CToaster, CRow, CCol,CCard,CCardBody, CFormLabel } from '@coreui/react';
import { useEnvStore } from '@/features/auth/store/useAuthStore';
import { setMode as apiSetMode, getMode, getAppointmentsWithModeWarning } from '@/api/apiClient';
import NetworkModal from '@/components/ui/MessageModal';

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
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [networkMsg, setNetworkMsg] = useState('');
  const [networkLoading, setNetworkLoading] = useState(false);

  useEffect(() => {
    getMode('database').then((backendMode) => {
      setSelectedMode(backendMode as 'dev' | 'prod');
      setMode(backendMode as 'dev' | 'prod');
    });
    getMode('rentri').then((backendMode) => {
      setSelectedRentriMode(backendMode as 'dev' | 'prod');
      setRentriMode(backendMode as 'dev' | 'prod');
    });
    getMode('ricetta').then((backendMode) => {
      setSelectedRicettaMode(backendMode as 'dev' | 'prod');
      setRicettaMode(backendMode as 'dev' | 'prod');
    });
    checkAppointments();
  }, [setMode, setRentriMode, setRicettaMode]);

  const handleApplyMode = async () => {
    try {
      setNetworkLoading(false);
      setShowNetworkModal(false);
      if (selectedMode === 'prod') {
        setNetworkLoading(true);
        setShowNetworkModal(true);
        setNetworkMsg('Ricerca della rete in corso...');
        const res = await apiSetMode('database', selectedMode);
        setNetworkLoading(false);
        if (res.error === 'network_unreachable') {
          setNetworkMsg(res.message + '\nSe richiesto, effettua il login alla risorsa di rete.');
          return;
        }
        if (!res.success) return;
        setMode('prod');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        setShowNetworkModal(false);
        return;
      }
      await apiSetMode('database', selectedMode);
      setMode(selectedMode);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 3000);
      setShowNetworkModal(false);
    }
  };

  const handleApplyRentri = async () => {
    try {
      await apiSetMode('rentri', selectedRentriMode);
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
      await apiSetMode('ricetta', selectedRicettaMode);
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
                    onClick={handleApplyMode}
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
      <NetworkModal
        open={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
        message={networkMsg}
        loading={networkLoading}
        link={networkMsg.includes('rete') ? 'file://SERVERDIMA/Pixel/WINDENT' : undefined}
      />
    </Card>
  );
};

export default SettingsPage; 