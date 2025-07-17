import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { 
  CFormSwitch, 
  CButton, 
  CToast, 
  CToastBody, 
  CToaster, 
  CRow, 
  CCol,
  CCard,
  CCardBody, 
  CFormLabel,
  CSpinner,
  CBadge
} from '@coreui/react';
import { useEnvStore } from '@/features/auth/store/useAuthStore';  // Il tuo store esistente
import { useSMSStore } from '@/store/smsStore';   // Nuovo store SMS dedicato
import { 
  setMode as apiSetMode, 
  getMode, 
  getSMSStatus, 
  testSMSConnection,
} from '@/api/services/settings.service';
import { getAppointmentsWithModeWarning } from '@/api/services/calendar.service';

import NetworkModal from '@/components/ui/MessageModal';


const SettingsPage: React.FC = () => {
  // Store esistente per database, rentri, ricetta
  const mode = useEnvStore((state) => state.mode);
  const setMode = useEnvStore((state) => state.setMode);
  const rentriMode = useEnvStore((state) => state.rentriMode);
  const setRentriMode = useEnvStore((state) => state.setRentriMode);
  const ricettaMode = useEnvStore((state) => state.ricettaMode);
  const setRicettaMode = useEnvStore((state) => state.setRicettaMode);
  const smsMode = useEnvStore((state) => state.smsMode);
  const setSmsMode = useEnvStore((state) => state.setSmsMode);

  // Store SMS dedicato
  const {
    status: smsStatus,
    setStatus: setSmsStatus,
    isLoading: smsLoading,
    setLoading: setSmsLoading,
    lastTestResult,
    setLastTestResult,
    isEnabled: isSMSEnabled,
    canSendSMS
  } = useSMSStore();

  // State esistente
  const [selectedMode, setSelectedMode] = useState<'dev' | 'prod'>(mode);
  const [selectedRentriMode, setSelectedRentriMode] = useState<'dev' | 'prod'>(rentriMode);
  const [selectedRicettaMode, setSelectedRicettaMode] = useState<'dev' | 'prod'>(ricettaMode);
  const [selectedSmsMode, setSelectedSmsMode] = useState< 'test' | 'prod'>(smsMode);

  // Toast state esistente
  const [showToast, setShowToast] = useState(false);
  const [errorToast, setErrorToast] = useState(false);
  const [modeWarning, setModeWarning] = useState<string | null>(null);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [networkMsg, setNetworkMsg] = useState('');
  const [networkLoading, setNetworkLoading] = useState(false);

  useEffect(() => {
    // Carica modalità esistenti
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
    
    // Carica modalità SMS
    getMode('sms').then((backendMode) => {
      setSelectedSmsMode(backendMode);
      setSmsMode(backendMode);
    });
    
    // Carica stato SMS
    loadSMSStatus();
    
    checkAppointments();
  }, [setMode, setRentriMode, setRicettaMode, setSmsMode]);

  const loadSMSStatus = async () => {
    try {
      setSmsLoading(true);
      const status = await getSMSStatus();
      setSmsStatus(status);
    } catch (error) {
      console.error('Errore caricamento stato SMS:', error);
    } finally {
      setSmsLoading(false);
    }
  };

  // Handler esistenti (invariati)
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

  // Handler SMS con store dedicato
  const handleApplySms = async () => {
    try {
      setSmsLoading(true);
      const result = await apiSetMode('sms', selectedSmsMode);
      
      if (!result.success) {
        if (result.error === 'missing_credentials') {
          setNetworkMsg(result.message || 'Credenziali Brevo mancanti');
          setShowNetworkModal(true);
          return;
        }
        throw new Error(result.error || 'Errore sconosciuto');
      }

      setSmsMode(selectedSmsMode);
      await loadSMSStatus(); // Ricarica lo stato dopo il cambio
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (error) {
      console.error('Errore cambio modalità SMS:', error);
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 3000);
    } finally {
      setSmsLoading(false);
    }
  };

  const handleTestSMS = async () => {
    try {
      setSmsLoading(true);
      const result = await testSMSConnection();
      
      // Salva il risultato nel store
      setLastTestResult({
        success: result.success,
        message: result.success ? result.message : result.error || 'Test fallito'
      });

      // Mostra il toast
      if (result.success) {
        setModeWarning(`✅ ${result.message}`);
      } else {
        setModeWarning(`❌ Test fallito: ${result.error}`);
      }
      
      setTimeout(() => setModeWarning(null), 5000);
    } catch (error) {
      const errorMsg = 'Errore test connessione SMS';
      setLastTestResult({
        success: false,
        message: errorMsg
      });
      setModeWarning(`❌ ${errorMsg}`);
      setTimeout(() => setModeWarning(null), 5000);
    } finally {
      setSmsLoading(false);
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

  // Funzioni helper
  const getSMSModeLabel = (mode:  'test' | 'prod') => {
    switch (mode) {
      case 'test': return 'Test';
      case 'prod': return 'Produzione';
      default: return mode;
    }
  };

  const getSMSBadgeColor = (enabled: boolean, mode: 'test' | 'prod') => {
    if (!enabled) return 'secondary';
    switch (mode) {
      case 'test': return 'warning';
      case 'prod': return 'success';
      default: return mode;
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

 const getDatabaseBadgeColor = (mode: 'dev' | 'prod') => {
    return mode === 'prod' ? 'success' : 'secondary';
  };

  const getRentriBadgeColor = (mode: 'dev' | 'prod') => {
    return mode === 'prod' ? 'success' : 'warning';
  };

  const getRicettaBadgeColor = (mode: 'dev' | 'prod') => {
    return mode === 'prod' ? 'success' : 'warning';
  };

  return (
    <Card title="Impostazioni">
      <CRow className="mt-4">
        {/* Prima colonna - DATABASE */}
        <CCol md={3}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-evenly mb-3 w-100">
                <div className="d-flex align-items-center">
                  <CFormLabel className="fw-semibold mb-0 me-2">DATABASE</CFormLabel>
                  <CBadge 
                    color={getDatabaseBadgeColor(selectedMode)}
                    className="ms-1"
                  >
                    {selectedMode === 'prod' ? '🏢' : '🏠'}
                  </CBadge>
                </div>
                
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

        {/* Seconda colonna - RENTRI */}
        <CCol md={3}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-evenly mb-3">
                <div className="d-flex align-items-center">
                  <CFormLabel className="fw-semibold mb-0 me-2">RENTRI</CFormLabel>
                  <CBadge 
                    color={getRentriBadgeColor(selectedRentriMode)}
                    className="ms-1"
                  >
                    {selectedRentriMode === 'prod' ? '🟢' : '🟡'}
                  </CBadge>
                </div>
                
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

        {/* Terza colonna - RNE */}
        <CCol md={3}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-evenly mb-3">
                <div className="d-flex align-items-center">
                  <CFormLabel className="fw-semibold mb-0 me-2">RNE</CFormLabel>
                  <CBadge 
                    color={getRicettaBadgeColor(selectedRicettaMode)}
                    className="ms-1"
                  >
                    {selectedRicettaMode === 'prod' ? '💊' : '🧪'}
                  </CBadge>
                </div>
                
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

        {/* Quarta colonna - SMS */}
        <CCol md={3}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-evenly mb-3">
                <div className="d-flex align-items-center">
                  <CFormLabel className="fw-semibold mb-0 me-2">SMS</CFormLabel>
                  {smsStatus && (
                    <CBadge 
                      color={getSMSBadgeColor(smsStatus.enabled, smsStatus.mode)}
                      className="ms-1"
                    >
                      {smsStatus.enabled ? '🟢' : '🔴'}
                    </CBadge>
                  )}
                </div>
                
                <CFormSwitch
                  id="sms-mode-switch"
                  label={selectedSmsMode === 'prod' ? 'Prod' : 'Test'}
                  checked={selectedSmsMode === 'prod'}
                  onChange={() => setSelectedSmsMode(selectedSmsMode === 'prod' ? 'test' : 'prod')}
                  color={selectedSmsMode === 'prod' ? 'success' : 'warning'}
                  disabled={smsLoading}
                />

                <div className="d-flex gap-1">
                  <CButton
                    color="primary"
                    size="sm"
                    disabled={selectedSmsMode === smsMode || smsLoading}
                    onClick={handleApplySms}
                  >
                    {smsLoading ? <CSpinner size="sm" /> : 'Applica'}
                  </CButton>
                  
                  <CButton
                    color="info"
                    size="sm"
                    disabled={!isSMSEnabled() || smsLoading}
                    onClick={handleTestSMS}
                    title="Test connessione"
                  >
                    {smsLoading ? <CSpinner size="sm" /> : '🧪'}
                  </CButton>
                </div>
              </div>

              {/* Risultato ultimo test */}
              {lastTestResult && (
                <div className="text-center mt-2">
                  <small className={lastTestResult.success ? 'text-success' : 'text-danger'}>
                    {lastTestResult.success ? '✅' : '❌'} Test: {new Date(lastTestResult.timestamp).toLocaleTimeString()}
                  </small>
                </div>
              )}
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