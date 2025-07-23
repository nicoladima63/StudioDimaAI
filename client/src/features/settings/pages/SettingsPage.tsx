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
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane, CBadge
} from '@coreui/react';
import { useEnvStore } from '@/features/auth/store/useAuthStore';
import { 
  setMode as apiSetMode, 
  getMode
} from '@/api/services/settings.service';
import { getAppointmentsWithModeWarning } from '@/api/services/calendar.service';
import TemplateEditor from '../components/TemplateEditor';
import AutomationReminderSettings from '../components/AutomationReminderSettings';
import AutomationRecallSettings from '../components/AutomationRecallSettings';
import AutomationCalendarSyncSettings from '../components/AutomationCalendarSyncSettings';
import NetworkModal from '@/components/ui/MessageModal';

const SettingsPage: React.FC = () => {
  // Store esistente per database, rentri, ricetta
  const mode = useEnvStore((state) => state.mode);
  const setMode = useEnvStore((state) => state.setMode);
  const rentriMode = useEnvStore((state) => state.rentriMode);
  const setRentriMode = useEnvStore((state) => state.setRentriMode);
  const ricettaMode = useEnvStore((state) => state.ricettaMode);
  const setRicettaMode = useEnvStore((state) => state.setRicettaMode);
  const setSmsMode = useEnvStore((state) => state.setSmsMode);

  // Tab state
  const [activeTab, setActiveTab] = useState('settings');

  // State esistente
  const [selectedMode, setSelectedMode] = useState<'dev' | 'prod'>(mode);
  const [selectedRentriMode, setSelectedRentriMode] = useState<'dev' | 'prod'>(rentriMode);
  const [selectedRicettaMode, setSelectedRicettaMode] = useState<'dev' | 'prod'>(ricettaMode);

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
      setSmsMode(backendMode as 'test' | 'prod');
    });
    
    checkAppointments();
  }, [setMode, setRentriMode, setRicettaMode, setSmsMode]);

  // Handler esistenti (mantenuti identici)
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

  // Funzioni helper
  const getDatabaseBadgeColor = (mode: 'dev' | 'prod') => {
    return mode === 'prod' ? 'success' : 'secondary';
  };

  const getRentriBadgeColor = (mode: 'dev' | 'prod') => {
    return mode === 'prod' ? 'success' : 'warning';
  };

  const getRicettaBadgeColor = (mode: 'dev' | 'prod') => {
    return mode === 'prod' ? 'success' : 'warning';
  };

  const toast = (
    <CToast autohide visible color="success" key="toast">
      <CToastBody>Modalità aggiornata con successo!</CToastBody>
    </CToast>
  );
  
  return (
    <Card title="Impostazioni">
      {/* Navigation Tabs */}
      <CNav variant="tabs" role="tablist">
        <CNavItem>
          <CNavLink
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            role="tab"
          >
            Impostazioni Generali
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'reminder'}
            onClick={() => setActiveTab('reminder')}
            role="tab"
          >
            Automazione Appuntamenti
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'recalls'}
            onClick={() => setActiveTab('recalls')}
            role="tab"
          >
           Automazione Richiami
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'calendar'}
            onClick={() => setActiveTab('calendar')}
            role="tab"
          >
            Automazione Calendario
          </CNavLink>
        </CNavItem>
      </CNav>

      {/* Tab Content */}
      <CTabContent className="mt-4">
        {/* Settings Tab */}
        <CTabPane visible={activeTab === 'settings'} role="tabpanel">
          <CRow className="mt-4">
            {/* DATABASE */}
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

            {/* RENTRI */}
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

            {/* RNE */}
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
          </CRow>
        </CTabPane>

        {/* Promemoria Appuntamenti Tab */}
        <CTabPane visible={activeTab === 'reminder'} role="tabpanel">
          <CRow>
            <CCol md={4}>
              <AutomationReminderSettings />
            </CCol>
            <CCol md={8}>
              <TemplateEditor 
                tipo="promemoria" 
                title="Template SMS Promemoria Appuntamento" 
                defaultVariables={["nome", "data", "ora", "telefono"]} 
              />
              {/* Spiegazione solo qui */}
              <CCard color="light" className="mt-3">
                <CCardBody>
                  <h6>💡 Come usare i template</h6>
                  <ul className="mb-0">
                    <li><strong>Variabili:</strong> Usa <code>{'{nome_completo}'}</code> per inserire il nome del paziente</li>
                    <li><strong>Lunghezza SMS:</strong> Un SMS standard è di 160 caratteri. Template più lunghi verranno divisi</li>
                    <li><strong>Anteprima:</strong> L'anteprima mostra come apparirà il messaggio con dati di esempio</li>
                    <li><strong>Reset:</strong> Ripristina il template ai valori di default del sistema</li>
                  </ul>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        {/* Richiami Tab */}
        <CTabPane visible={activeTab === 'recalls'} role="tabpanel">
          <CRow>
            <CCol md={4}>
              <AutomationRecallSettings />
            </CCol>
            <CCol md={8}>
              <TemplateEditor
                tipo="richiamo"
                title="Template SMS Richiamo"
                defaultVariables={['nome_completo', 'tipo_richiamo', 'data_richiamo']}
              />
              {/* Spiegazione solo qui */}
              <CCard color="light" className="mt-3">
                <CCardBody>
                  <h6>💡 Come usare i template</h6>
                  <ul className="mb-0">
                    <li><strong>Variabili:</strong> Usa <code>{'{nome_completo}'}</code> per inserire il nome del paziente</li>
                    <li><strong>Lunghezza SMS:</strong> Un SMS standard è di 160 caratteri. Template più lunghi verranno divisi</li>
                    <li><strong>Anteprima:</strong> L'anteprima mostra come apparirà il messaggio con dati di esempio</li>
                    <li><strong>Reset:</strong> Ripristina il template ai valori di default del sistema</li>
                  </ul>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        {/* Calendar Sync Tab */}
        <CTabPane visible={activeTab === 'calendar'} role="tabpanel">
          <CRow>
            <CCol md={6}>
              <AutomationCalendarSyncSettings />
            </CCol>
            <CCol md={6}>
              <CCard color="light">
                <CCardBody>
                  <h6>📅 Sincronizzazione Automatica Calendario</h6>
                  <ul className="mb-0">
                    <li><strong>Automatica:</strong> Sincronizza ogni sera alle 21:00 (configurabile)</li>
                    <li><strong>Calendari:</strong> Studio Blu e Studio Giallo configurati automaticamente</li>
                    <li><strong>Periodo:</strong> Sincronizza mese corrente + prossimo mese</li>
                    <li><strong>Weekend:</strong> Salta automaticamente sabato e domenica</li>
                    <li><strong>Azioni Rapide:</strong> Sincronizza o cancella tutti i calendari manualmente</li>
                    <li><strong>Log:</strong> Tutte le operazioni vengono registrate per il monitoraggio</li>
                  </ul>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>
      </CTabContent>

      <CToaster placement="top-end">
        {showToast && toast}
        {errorToast && (
          <CToast autohide visible color="danger" key="error-toast">
            <CToastBody>Errore nel cambio modalità!</CToastBody>
          </CToast>
        )}
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