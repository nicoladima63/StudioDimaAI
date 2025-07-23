import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { 
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CFormSwitch,
  CFormLabel,
  CBadge,
  CButton,
  CRow,
  CCol,
  CCard,
  CCardHeader,
  CCardBody,
  CToast,
  CToastBody,
  CToaster,
  CAlert,CSpinner
} from '@coreui/react';
import { useEnvStore, useAuthStore } from '@/features/auth/store/useAuthStore';
import { getRentriMode, setRentriMode, testRentriAuthorization, getRegistri, type Registro } from '@/api/services/rentri.service';
import RegistriTab from '../components/RegistriTab';
import MovimentiTab from '../components/MovimentiTab';
import FIRTab from '../components/FIRTab';

const RentriPage: React.FC = () => {
  const rentriMode = useEnvStore((state) => state.rentriMode);
  const setRentriModeStore = useEnvStore((state) => state.setRentriMode);
  const token = useAuthStore((state) => state.token);
  const username = useAuthStore((state) => state.username);
  const isAuthenticated = Boolean(token);

  const [activeTab, setActiveTab] = useState('registri');
  const [selectedRentriMode, setSelectedRentriMode] = useState<'dev' | 'prod'>(rentriMode);
  const [showToast, setShowToast] = useState(false);
  const [errorToast, setErrorToast] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authResult, setAuthResult] = useState<{success: boolean, message: string, details?: any} | null>(null);
  const [registri, setRegistri] = useState<Registro[]>([]);
  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null);
  const [registriLoading, setRegistriLoading] = useState(false);

  useEffect(() => {
    loadRentriMode();
    loadRegistri();
  }, []);

  useEffect(() => {
    setIsDemo(rentriMode === 'dev');
    // Ricarica i registri quando cambia la modalità
    if (rentriMode) {
      loadRegistri();
    }
  }, [rentriMode]);

  const loadRentriMode = async () => {
    try {
      const mode = await getRentriMode();
      setSelectedRentriMode(mode as 'dev' | 'prod');
      setRentriModeStore(mode as 'dev' | 'prod');
    } catch (error) {
      console.error('Error loading RENTRI mode:', error);
    }
  };

  const loadRegistri = async () => {
    if (!isAuthenticated) return;
    
    setRegistriLoading(true);
    try {
      const data = await getRegistri(rentriMode === 'dev');
      setRegistri(data.registri || []);
      
      // Seleziona automaticamente il primo registro se disponibile
      if (data.registri && data.registri.length > 0) {
        setSelectedRegistro(data.registri[0]);
      }
    } catch (error) {
      console.error('Error loading registri:', error);
      setRegistri([]);
      setSelectedRegistro(null);
    } finally {
      setRegistriLoading(false);
    }
  };

  const handleApplyRentri = async () => {
    try {
      await setRentriMode(selectedRentriMode);
      setRentriModeStore(selectedRentriMode);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 3000);
    }
  };

  const handleTestAuthorization = async () => {
    if (!isAuthenticated) {
      setAuthResult({
        success: false,
        message: 'Autenticazione richiesta',
        details: { error: 'Devi effettuare il login per utilizzare questa funzionalità' }
      });
      return;
    }

    setAuthLoading(true);
    setAuthResult(null);
    
    try {
      const result = await testRentriAuthorization();
      setAuthResult(result);
    } catch (error: any) {
      // Gestione specifica per errori di autenticazione
      if (error.response?.status === 401) {
        setAuthResult({
          success: false,
          message: 'Sessione scaduta',
          details: { error: 'Effettua nuovamente il login per continuare' }
        });
      } else {
        setAuthResult({
          success: false,
          message: error.response?.data?.message || 'Errore durante il test di autorizzazione',
          details: error.response?.data?.details || { error: error.message }
        });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const getRentriBadgeColor = (mode: 'dev' | 'prod') => {
    return mode === 'prod' ? 'success' : 'warning';
  };

  const toast = (
    <CToast autohide visible color="success" key="toast">
      <CToastBody>Modalità RENTRI aggiornata con successo!</CToastBody>
    </CToast>
  );

  return (
    <Card title="Gestione RENTRI - Sistema Rifiuti">
      {/* Mode Control Section */}
      <CRow className="mb-4">
        <CCol md={6}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <CFormLabel className="fw-semibold mb-0 me-2">MODALITÀ RENTRI</CFormLabel>
                  <CBadge 
                    color={getRentriBadgeColor(selectedRentriMode)}
                    className="ms-1"
                  >
                    {selectedRentriMode === 'prod' ? '🏭 PRODUZIONE' : '🧪 TEST'}
                  </CBadge>
                </div>
                
                <div className="d-flex align-items-center gap-2">
                  <CFormSwitch
                    id="rentri-mode-switch"
                    label={selectedRentriMode === 'prod' ? 'Produzione' : 'Test'}
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
              </div>
              
              {isDemo && (
                <CAlert color="warning" className="mt-3 mb-0">
                  <small>
                    <strong>Modalità Demo:</strong> Stai utilizzando l'ambiente di test RENTRI. 
                    I dati non sono reali e le operazioni non avranno effetto sul sistema di produzione.
                  </small>
                </CAlert>
              )}
            </CCardBody>
          </CCard>
        </CCol>
        
        <CCol md={6}>
          <CCard>
            <CCardHeader>
              <strong>🔐 Test Autorizzazione</strong>
            </CCardHeader>
            <CCardBody>
              <div className="d-flex flex-column gap-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <CButton
                    color={isAuthenticated ? "warning" : "secondary"}
                    onClick={handleTestAuthorization}
                    disabled={authLoading}
                  >
                    {authLoading ? <CSpinner size="sm" className="me-2" /> : '🔑 '}
                    Testa Autorizzazione
                  </CButton>
                  
                  {isAuthenticated && (
                    <small className="text-success">
                      ✅ Autenticato come <strong>{username}</strong>
                    </small>
                  )}
                  
                  {!isAuthenticated && (
                    <div className="d-flex flex-column">
                      <small className="text-warning">
                        ⚠️ Login richiesto
                      </small>
                      <a href="/login" className="small text-primary">
                        → Vai al login
                      </a>
                    </div>
                  )}
                </div>
                
                <small className="text-muted">
                  Verifica il certificato e l'autorizzazione RENTRI in modalità produzione
                </small>
                
                {authResult && (
                  <CAlert 
                    color={authResult.success ? 'success' : 'danger'} 
                    className="mb-0"
                  >
                    <div>
                      <strong>{authResult.success ? '✅' : '❌'} {authResult.message}</strong>
                    </div>
                    
                    {authResult.details && (
                      <div className="mt-2">
                        <small>
                          {authResult.success ? (
                            <>
                              <div>• Certificato: {authResult.details.certificate_found ? 'Trovato' : 'Non trovato'}</div>
                              <div>• Headers: {authResult.details.auth_headers_generated ? 'Generati' : 'Non generati'}</div>
                              <div>• Modalità: {authResult.details.mode}</div>
                            </>
                          ) : (
                            <div>• Errore: {authResult.details.error || 'Dettagli non disponibili'}</div>
                          )}
                        </small>
                      </div>
                    )}
                  </CAlert>
                )}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Navigation Tabs */}
      <CNav variant="tabs" role="tablist">
        <CNavItem>
          <CNavLink
            active={activeTab === 'registri'}
            onClick={() => setActiveTab('registri')}
            role="tab"
          >
            📋 Registri
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'movimenti'}
            onClick={() => setActiveTab('movimenti')}
            role="tab"
          >
            🔄 Movimenti
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'fir'}
            onClick={() => setActiveTab('fir')}
            role="tab"
          >
            📄 FIR
          </CNavLink>
        </CNavItem>
      </CNav>

      {/* Tab Content */}
      <CTabContent className="mt-4">
        <CTabPane visible={activeTab === 'registri'} role="tabpanel">
          <RegistriTab 
            isDemo={isDemo} 
            registri={registri}
            selectedRegistro={selectedRegistro}
            onSelectRegistro={setSelectedRegistro}
            loading={registriLoading}
            onReload={loadRegistri}
          />
        </CTabPane>

        <CTabPane visible={activeTab === 'movimenti'} role="tabpanel">
          <MovimentiTab 
            isDemo={isDemo} 
            selectedRegistro={selectedRegistro}
          />
        </CTabPane>

        <CTabPane visible={activeTab === 'fir'} role="tabpanel">
          <FIRTab 
            isDemo={isDemo}
            selectedRegistro={selectedRegistro} 
          />
        </CTabPane>
      </CTabContent>

      <CToaster placement="top-end">
        {showToast && toast}
        {errorToast && (
          <CToast autohide visible color="danger" key="error-toast">
            <CToastBody>Errore nel cambio modalità RENTRI!</CToastBody>
          </CToast>
        )}
      </CToaster>
    </Card>
  );
};

export default RentriPage;