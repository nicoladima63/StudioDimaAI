import React, { useState } from 'react';
import { 
  CAlert, 
  CModal, 
  CModalHeader, 
  CModalTitle, 
  CModalBody, 
  CModalFooter, 
  CButton, 
  CSpinner,
  CBadge,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
  CForm,
  CFormInput,
  CFormLabel
} from '@coreui/react';
import { ServiceType, Environment } from '../../../types/environment.types';
import { EnvironmentCard } from '../base';
import { useEnvironmentTest } from '../../../store/environment.store';

/**
 * Componente specializzato per switch ambiente Rentri
 * Include validazione chiave privata e test API governative
 */
const RentriModeSwitch: React.FC = () => {
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiTest, setShowApiTest] = useState(false);
  const [searchQuery, setSearchQuery] = useState({
    comune: 'Roma',
    via: 'Via Roma'
  });

  const { test } = useEnvironmentTest();

  const validateRentriConfig = async (targetEnvironment: Environment): Promise<boolean> => {
    setIsTesting(true);
    setShowTestModal(true);

    try {
      const testResult = await test(ServiceType.RENTRI, targetEnvironment);
      setTestResult(testResult);
      setIsTesting(false);

      return testResult.success;
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message,
        message: 'Errore test configurazione Rentri'
      });
      setIsTesting(false);
      return false;
    }
  };

  const handleApiTest = async () => {
    setIsTesting(true);

    try {
      // Simula test ricerca immobili
      const response = await fetch('/api/v2/rentri/test-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchQuery)
      });

      const result = await response.json();
      
      setTestResult({
        ...testResult,
        api_test: result
      });

    } catch (error: any) {
      setTestResult({
        ...testResult,
        api_test: {
          success: false,
          error: error.message,
          message: 'Errore test API Rentri'
        }
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleEnvironmentChange = (environment: Environment) => {
    console.log(`Rentri ambiente cambiato a: ${environment}`);
  };

  const handleTest = async () => {
    await validateRentriConfig(Environment.DEV);
  };

  const getConfigurationStatus = () => {
    if (!testResult?.details) return null;

    const checks = Object.entries(testResult.details);
    
    return (
      <div className="mt-3">
        <h6>Stato Configurazione:</h6>
        <CTable small responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Componente</CTableHeaderCell>
              <CTableHeaderCell>Stato</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {checks.map(([checkName, isValid]) => (
              <CTableRow key={checkName}>
                <CTableDataCell>
                  {checkName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge color={isValid ? 'success' : 'danger'}>
                    {isValid ? '✅ OK' : '❌ Errore'}
                  </CBadge>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>
    );
  };

  const getConnectionStatus = () => {
    if (!testResult) return null;

    if (testResult.success) {
      return (
        <CAlert color="success">
          <strong>✅ Configurazione Rentri OK</strong>
          <ul className="mb-0 mt-2">
            <li>Token URL: {testResult.details?.token_url}</li>
            <li>Chiave privata: Presente e valida</li>
            <li>Client ID: Configurato</li>
            {testResult.details?.client_audience_configured && (
              <li>Audience: Configurata</li>
            )}
          </ul>
        </CAlert>
      );
    }

    return (
      <CAlert color="danger">
        <strong>❌ Problema Configurazione</strong>
        <p className="mb-0 mt-2">{testResult.message}</p>
        {testResult.error && (
          <small className="d-block mt-1 text-muted">
            Dettaglio: {testResult.error}
          </small>
        )}
      </CAlert>
    );
  };

  const getTroubleshootingTips = () => {
    if (!testResult || testResult.success) return null;

    const tips = [];
    
    if (!testResult.details?.private_key_exists) {
      tips.push('Verifica che il file della chiave privata sia presente nel percorso configurato');
      tips.push('Controlla che il path RENTRI_PRIVATE_KEY_PATH_* sia corretto nel file .env');
      tips.push('Assicurati che il file abbia i permessi di lettura corretti');
    }
    
    if (!testResult.details?.client_id_configured) {
      tips.push('Configura RENTRI_CLIENT_ID_* nel file .env');
      tips.push('Verifica che il Client ID sia quello fornito dal portale Rentri');
    }
    
    if (!testResult.details?.client_audience_configured) {
      tips.push('Configura RENTRI_CLIENT_AUDIENCE_* nel file .env');
      tips.push('Verifica che l\'audience sia corretta per l\'ambiente target');
    }

    if (tips.length === 0) {
      tips.push('Verifica che tutti i parametri Rentri siano configurati correttamente');
      tips.push('Controlla che l\'ambiente target (dev/prod) abbia le configurazioni complete');
      tips.push('Verifica la connettività verso i servizi Rentri');
    }

    return (
      <div className="mt-3">
        <h6>Risoluzione problemi:</h6>
        <ul className="small">
          {tips.map((tip, index) => (
            <li key={index}>{tip}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      <EnvironmentCard
        service={ServiceType.RENTRI}
        title="Rentri"
        description="Integrazione API governative per ricerche immobiliari"
        badge={{
          success: '🏛️ Connesso',
          warning: '⚠️ Da testare',
          danger: '❌ Errore'
        }}
        showTestButton={true}
        showStatus={true}
        onEnvironmentChange={handleEnvironmentChange}
        onTest={handleTest}
      />

      <CModal
        visible={showTestModal}
        onClose={() => !isTesting && setShowTestModal(false)}
        backdrop={isTesting ? 'static' : true}
        keyboard={!isTesting}
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>Test Configurazione Rentri</CModalTitle>
        </CModalHeader>
        
        <CModalBody>
          {isTesting && !testResult && (
            <div className="text-center p-4">
              <CSpinner className="me-2" />
              <span>Test configurazione Rentri in corso...</span>
            </div>
          )}

          {testResult && getConnectionStatus()}
          {testResult && getConfigurationStatus()}

          {testResult?.success && (
            <div className="border-top pt-3 mt-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Test API Rentri</h6>
                <CBadge color="info">Opzionale</CBadge>
              </div>

              {!showApiTest ? (
                <CButton
                  color="outline-primary"
                  size="sm"
                  onClick={() => setShowApiTest(true)}
                >
                  🔍 Test Ricerca Immobili
                </CButton>
              ) : (
                <CForm>
                  <CFormLabel htmlFor="test-comune">Comune:</CFormLabel>
                  <CFormInput
                    id="test-comune"
                    placeholder="Roma"
                    value={searchQuery.comune}
                    onChange={(e) => setSearchQuery({
                      ...searchQuery,
                      comune: e.target.value
                    })}
                    className="mb-3"
                  />

                  <CFormLabel htmlFor="test-via">Via:</CFormLabel>
                  <CFormInput
                    id="test-via"
                    placeholder="Via Roma"
                    value={searchQuery.via}
                    onChange={(e) => setSearchQuery({
                      ...searchQuery,
                      via: e.target.value
                    })}
                    className="mb-3"
                  />

                  <div className="d-flex gap-2">
                    <CButton
                      color="primary"
                      size="sm"
                      onClick={handleApiTest}
                      disabled={isTesting}
                    >
                      {isTesting && <CSpinner size="sm" className="me-1" />}
                      Esegui Ricerca
                    </CButton>
                    <CButton
                      color="secondary"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowApiTest(false)}
                    >
                      Annulla
                    </CButton>
                  </div>
                </CForm>
              )}

              {testResult.api_test && (
                <div className="mt-3">
                  {testResult.api_test.success ? (
                    <CAlert color="success">
                      ✅ API test completato! 
                      {testResult.api_test.properties && (
                        <span> Trovati {testResult.api_test.properties.length} risultati</span>
                      )}
                    </CAlert>
                  ) : (
                    <CAlert color="danger">
                      ❌ Errore API: {testResult.api_test.message}
                    </CAlert>
                  )}
                </div>
              )}
            </div>
          )}

          {getTroubleshootingTips()}

          {testResult?.success && (
            <div className="mt-3 p-3 bg-light rounded">
              <h6 className="text-success mb-2">🎉 Integrazione Rentri pronta!</h6>
              <p className="mb-0 small">
                La configurazione Rentri è corretta e il sistema può comunicare 
                con le API governative. È possibile procedere con le ricerche 
                immobiliari.
              </p>
            </div>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowTestModal(false)}
            disabled={isTesting}
          >
            Chiudi
          </CButton>
          
          {testResult && !testResult.success && (
            <CButton
              color="primary"
              onClick={() => validateRentriConfig(Environment.DEV)}
              disabled={isTesting}
            >
              Riprova Test
            </CButton>
          )}

          {testResult?.success && (
            <CButton
              color="success"
              onClick={() => setShowTestModal(false)}
            >
              Continua
            </CButton>
          )}
        </CModalFooter>
      </CModal>
    </>
  );
};

export default RentriModeSwitch;