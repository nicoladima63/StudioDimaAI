import React, { useState, useEffect } from 'react';
import { CButton, CCard, CCardBody, CAlert, CSpinner, CBadge } from '@coreui/react';
import { testRicettaConnection, ricettaAuthLogin, getRicettaAuthStatus } from '@/api/services/ricette.service';

interface AuthStatusData {
  success: boolean;
  token?: string;
  cf_medico?: string;
  ambiente?: string;
  endpoint_invio?: string;
  error?: string;
}

const RicettaAuthStatus: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const result = await testRicettaConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: 'Errore di connessione' });
    } finally {
      setLoading(false);
    }
  };

  const handleAuthLogin = async () => {
    setLoading(true);
    try {
      const result = await ricettaAuthLogin();
      setAuthStatus(result);
    } catch (error) {
      setAuthStatus({ success: false, error: 'Errore di autenticazione' });
    } finally {
      setLoading(false);
    }
  };

  const handleGetStatus = async () => {
    setLoading(true);
    try {
      const result = await getRicettaAuthStatus();
      setAuthStatus(result);
    } catch (error) {
      setAuthStatus({ success: false, error: 'Errore nel recupero dello status' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carica lo status all'avvio
    handleGetStatus();
  }, []);

  return (
    <div className="d-flex justify-content-end align-items-center mb-3">
      <div className="d-flex gap-2 align-items-center">
        {/* Badge status discreti */}
        {authStatus?.success ? (
          <CBadge color="success" className="d-flex align-items-center">
            ✅ Autenticato
          </CBadge>
        ) : (
          <CBadge color="secondary" className="d-flex align-items-center">
            🔒 Non autenticato
          </CBadge>
        )}
        
        {testResult?.success ? (
          <CBadge color="info">🌐 Connesso</CBadge>
        ) : (
          <CBadge color="warning">⚠️ Disconnesso</CBadge>
        )}

        {/* Pulsanti compatti */}
        <CButton 
          color="outline-primary" 
          size="sm" 
          onClick={handleTestConnection}
          disabled={loading}
          title="Test connessione"
        >
          {loading ? <CSpinner size="sm" /> : '🔗'}
        </CButton>
        
        <CButton 
          color="outline-success" 
          size="sm" 
          onClick={handleAuthLogin}
          disabled={loading}
          title="Autentica sistema TS"
        >
          {loading ? <CSpinner size="sm" /> : '🔐'}
        </CButton>

        {/* Dropdown info dettagliate (opzionale) */}
        {authStatus?.success && (
          <small className="text-muted ms-2">
            Ambiente: {authStatus.ambiente?.toUpperCase()}
          </small>
        )}
      </div>
    </div>
  );
};

export default RicettaAuthStatus;