import React, { useState } from 'react';
import {
  CCard, CCardBody, CButton, CSpinner, CAlert, CFormTextarea,
  CRow, CCol, CBadge
} from '@coreui/react';
import apiClient from '@/api/client';

const TestSistemaTSRaw: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testSistemaTS = async () => {
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      console.log('Chiamata diretta al Sistema TS per lista ricette...');
      
      // Chiamata diretta all'endpoint modificato senza force_local
      const result = await apiClient.get('/api/ricetta/database/list');
      
      console.log('Risposta ricevuta:', result.data);
      setResponse(result.data);
      
    } catch (err: any) {
      console.error('Errore test Sistema TS:', err);
      setError(err.response?.data?.error || err.message || 'Errore durante il test');
    } finally {
      setLoading(false);
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'sistema_ts':
        return <CBadge color="success">🌐 Sistema TS</CBadge>;
      case 'database_locale':
        return <CBadge color="info">💾 Database Locale</CBadge>;
      case 'database_locale_fallback':
        return <CBadge color="warning">💾 DB Locale (Fallback)</CBadge>;
      default:
        return <CBadge color="secondary">{source}</CBadge>;
    }
  };

  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <div>
      <CRow>
        <CCol md={12}>
          <CCard>
            <CCardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>🌐 Test Sistema TS - Risposta Raw</h5>
                <CButton 
                  color="primary" 
                  onClick={testSistemaTS} 
                  disabled={loading}
                >
                  {loading ? <CSpinner size="sm" className="me-2" /> : '🧪'} 
                  Test Lista Ricette
                </CButton>
              </div>

              <p className="text-muted">
                Questo test chiama direttamente l'endpoint per recuperare la lista ricette dal Sistema TS 
                e mostra la risposta completa del server per debugging.
              </p>

              {error && (
                <CAlert color="danger">
                  <strong>Errore:</strong> {error}
                </CAlert>
              )}

              {response && (
                <div>
                  {/* Info di base */}
                  <div className="mb-3">
                    <h6>📊 Info Risposta:</h6>
                    <p><strong>Successo:</strong> {response.success ? '✅ Sì' : '❌ No'}</p>
                    <p><strong>Fonte Dati:</strong> {getSourceBadge(response.source)}</p>
                    <p><strong>Conteggio:</strong> {response.count || 0} ricette</p>
                    
                    {response.warning && (
                      <CAlert color="warning">
                        <strong>Avviso:</strong> {response.warning}
                      </CAlert>
                    )}

                    {response.ts_response && (
                      <div>
                        <p><strong>Messaggio TS:</strong> {response.ts_response.message}</p>
                        <p><strong>Timestamp:</strong> {response.ts_response.timestamp}</p>
                      </div>
                    )}
                  </div>

                  {/* Risposta completa */}
                  <div>
                    <h6>📄 Risposta Completa JSON:</h6>
                    <CFormTextarea
                      value={formatJson(response)}
                      rows={25}
                      readOnly
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  </div>
                </div>
              )}

              {!response && !error && !loading && (
                <CAlert color="info">
                  Clicca "Test Lista Ricette" per vedere la risposta del Sistema TS
                </CAlert>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  );
};

export default TestSistemaTSRaw;