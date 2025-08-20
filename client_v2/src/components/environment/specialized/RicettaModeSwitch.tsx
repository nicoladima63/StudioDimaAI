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
  CTableDataCell
} from '@coreui/react';
import { ServiceType, Environment } from '../../../types/environment.types';
import { EnvironmentCard } from '../base';
import { useEnvironmentTest } from '../../../store/environment.store';

/**
 * Componente specializzato per switch ambiente ricetta elettronica
 * Include validazione certificati SSL e test connessione Sistema TS
 */
const RicettaModeSwitch: React.FC = () => {
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const { test } = useEnvironmentTest();

  const validateRicettaConfig = async (targetEnvironment: Environment): Promise<boolean> => {
    setIsTesting(true);
    setShowTestModal(true);

    try {
      const testResult = await test(ServiceType.RICETTA, targetEnvironment);
      setTestResult(testResult);
      setIsTesting(false);

      return testResult.success;
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message,
        message: 'Errore test ricetta elettronica'
      });
      setIsTesting(false);
      return false;
    }
  };

  const handleEnvironmentChange = (environment: Environment) => {
    console.log(`Ricetta ambiente cambiato a: ${environment}`);
  };

  const handleTest = async () => {
    await validateRicettaConfig(Environment.TEST);
  };

  const getCertificateStatus = () => {
    if (!testResult?.certificates) return null;

    const certificates = Object.entries(testResult.certificates);
    
    return (
      <div className="mt-3">
        <h6>Stato Certificati SSL:</h6>
        <CTable small responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Certificato</CTableHeaderCell>
              <CTableHeaderCell>Stato</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {certificates.map(([certName, isValid]) => (
              <CTableRow key={certName}>
                <CTableDataCell>{certName}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={isValid ? 'success' : 'danger'}>
                    {isValid ? '✅ Valido' : '❌ Mancante'}
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
          <strong>✅ Connessione Sistema Tessera Sanitaria OK</strong>
          <ul className="mb-0 mt-2">
            <li>Endpoint: {testResult.endpoint}</li>
            <li>SSL Version: {testResult.ssl_version}</li>
            <li>Status Code: {testResult.status_code}</li>
            {testResult.environment && (
              <li>Ambiente: {testResult.environment.toUpperCase()}</li>
            )}
          </ul>
        </CAlert>
      );
    }

    return (
      <CAlert color="danger">
        <strong>❌ Problema Connessione</strong>
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
    
    if (testResult.error?.includes('certificate') || testResult.error?.includes('SSL')) {
      tips.push('Verifica che i certificati SSL siano presenti nella cartella certs/');
      tips.push('Controlla che i certificati non siano scaduti');
      tips.push('Assicurati che il certificato client sia valido per l\'ambiente selezionato');
    }
    
    if (testResult.error?.includes('timeout') || testResult.error?.includes('connection')) {
      tips.push('Verifica la connessione internet');
      tips.push('Controlla che il servizio Sistema TS sia raggiungibile');
      tips.push('Verifica le impostazioni firewall aziendali');
    }
    
    if (testResult.status_code === 401 || testResult.status_code === 403) {
      tips.push('Verifica le credenziali medico nel file .env');
      tips.push('Controlla che il certificato sia autorizzato per il codice fiscale medico');
      tips.push('Assicurati che il certificato sia abilitato per l\'ambiente target');
    }

    if (tips.length === 0) {
      tips.push('Verifica la configurazione generale del servizio ricetta');
      tips.push('Controlla i log del server per dettagli aggiuntivi');
      tips.push('Contatta il supporto tecnico se il problema persiste');
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
        service={ServiceType.RICETTA}
        title="Ricetta Elettronica"
        description="Sistema Tessera Sanitaria per ricette elettroniche (test/produzione)"
        badge={{
          success: '💊 Operativo',
          warning: '🧪 Test',
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
          <CModalTitle>Test Ricetta Elettronica</CModalTitle>
        </CModalHeader>
        
        <CModalBody>
          {isTesting && !testResult && (
            <div className="text-center p-4">
              <CSpinner className="me-2" />
              <span>Test connessione Sistema Tessera Sanitaria...</span>
            </div>
          )}

          {testResult && getConnectionStatus()}
          {testResult && getCertificateStatus()}
          {testResult && getTroubleshootingTips()}

          {testResult?.success && (
            <div className="mt-3 p-3 bg-light rounded">
              <h6 className="text-success mb-2">🎉 Sistema pronto per l'uso!</h6>
              <p className="mb-0 small">
                La ricetta elettronica è configurata correttamente e il sistema può 
                comunicare con il Sistema Tessera Sanitaria. È possibile procedere 
                con l'invio delle ricette.
              </p>
            </div>
          )}

          {testResult && testResult.environment === 'test' && (
            <CAlert color="info" className="mt-3">
              <strong>ℹ️ Ambiente di Test</strong>
              <p className="mb-0 small mt-1">
                Stai utilizzando l'ambiente di test. Le ricette inviate non avranno 
                valore legale e servono solo per verificare il corretto funzionamento 
                del sistema.
              </p>
            </CAlert>
          )}

          {testResult && testResult.environment === 'prod' && (
            <CAlert color="warning" className="mt-3">
              <strong>⚠️ Ambiente di Produzione</strong>
              <p className="mb-0 small mt-1">
                Stai utilizzando l'ambiente di produzione. Le ricette inviate avranno 
                valore legale. Assicurati che tutti i dati siano corretti prima 
                dell'invio.
              </p>
            </CAlert>
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
              onClick={() => validateRicettaConfig(Environment.TEST)}
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

export default RicettaModeSwitch;