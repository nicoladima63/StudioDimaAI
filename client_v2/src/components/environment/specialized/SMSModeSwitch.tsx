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
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea
} from '@coreui/react';
import { ServiceType, Environment } from '../../../types/environment.types';
import { EnvironmentCard } from '../base';
import { useEnvironmentTest } from '../../../store/environment.store';

/**
 * Componente specializzato per switch ambiente SMS
 * Include test credenziali Brevo e invio SMS di prova
 */
const SMSModeSwitch: React.FC = () => {
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showSendTest, setShowSendTest] = useState(false);
  const [testSMSData, setTestSMSData] = useState({
    recipient: '',
    message: 'Test SMS dal sistema StudioDimaAI'
  });

  const { test } = useEnvironmentTest();

  const validateSMSConfig = async (targetEnvironment: Environment): Promise<boolean> => {
    if (targetEnvironment === Environment.DEV) {
      return true; // DEV non ha validazioni specifiche
    }

    // Per TEST e PROD, verifica credenziali Brevo
    setIsTesting(true);
    setShowTestModal(true);

    try {
      const testResult = await test(ServiceType.SMS, targetEnvironment);
      setTestResult(testResult);
      setIsTesting(false);

      return testResult.success;
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message,
        message: 'Errore test configurazione SMS'
      });
      setIsTesting(false);
      return false;
    }
  };

  const handleSendTestSMS = async () => {
    if (!testSMSData.recipient.trim()) {
      alert('Inserisci un numero di telefono');
      return;
    }

    setIsTesting(true);

    try {
      // Simula invio SMS di test tramite API
      const response = await fetch('/api/v2/sms/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: testSMSData.recipient,
          message: testSMSData.message,
          tag: 'test-sms'
        })
      });

      const result = await response.json();
      
      setTestResult({
        ...testResult,
        test_send: result
      });

    } catch (error: any) {
      setTestResult({
        ...testResult,
        test_send: {
          success: false,
          error: error.message,
          message: 'Errore invio SMS test'
        }
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleEnvironmentChange = (environment: Environment) => {
    console.log(`SMS ambiente cambiato a: ${environment}`);
  };

  const handleTest = async () => {
    await validateSMSConfig(Environment.TEST);
  };

  const getCredentialsStatus = () => {
    if (!testResult) return null;

    if (testResult.success && testResult.account_info) {
      return (
        <CAlert color="success">
          <strong>✅ Credenziali Brevo valide</strong>
          <ul className="mb-0 mt-2">
            <li>Account: {testResult.account_info.company_name || testResult.account_info.email}</li>
            <li>Piano: {testResult.account_info.plan_type || 'Sconosciuto'}</li>
            <li>Mittente: {testResult.sender}</li>
          </ul>
        </CAlert>
      );
    }

    return (
      <CAlert color="danger">
        <strong>❌ Problema credenziali</strong>
        <p className="mb-0 mt-2">{testResult.message}</p>
        {testResult.status_code === 401 && (
          <small className="d-block mt-1">
            Verifica la variabile BREVO_API_KEY nel file .env
          </small>
        )}
      </CAlert>
    );
  };

  return (
    <>
      <EnvironmentCard
        service={ServiceType.SMS}
        title="SMS Brevo"
        description="Invio SMS tramite piattaforma Brevo (test/produzione)"
        badge={{
          success: '📱 Attivo',
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
          <CModalTitle>Test Configurazione SMS</CModalTitle>
        </CModalHeader>
        
        <CModalBody>
          {isTesting && !testResult && (
            <div className="text-center p-4">
              <CSpinner className="me-2" />
              <span>Test credenziali Brevo in corso...</span>
            </div>
          )}

          {testResult && getCredentialsStatus()}

          {testResult?.success && (
            <div className="border-top pt-3 mt-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Test invio SMS</h6>
                <CBadge color="info">Opzionale</CBadge>
              </div>

              {!showSendTest ? (
                <CButton
                  color="outline-primary"
                  size="sm"
                  onClick={() => setShowSendTest(true)}
                >
                  📱 Invia SMS di Test
                </CButton>
              ) : (
                <CForm>
                  <CFormLabel htmlFor="test-recipient">Numero destinatario:</CFormLabel>
                  <CFormInput
                    id="test-recipient"
                    placeholder="+39 3XX XXXXXXX"
                    value={testSMSData.recipient}
                    onChange={(e) => setTestSMSData({
                      ...testSMSData,
                      recipient: e.target.value
                    })}
                    className="mb-3"
                  />

                  <CFormLabel htmlFor="test-message">Messaggio:</CFormLabel>
                  <CFormTextarea
                    id="test-message"
                    rows={3}
                    value={testSMSData.message}
                    onChange={(e) => setTestSMSData({
                      ...testSMSData,
                      message: e.target.value
                    })}
                    className="mb-3"
                  />

                  <div className="d-flex gap-2">
                    <CButton
                      color="primary"
                      size="sm"
                      onClick={handleSendTestSMS}
                      disabled={isTesting}
                    >
                      {isTesting && <CSpinner size="sm" className="me-1" />}
                      Invia Test
                    </CButton>
                    <CButton
                      color="secondary"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowSendTest(false)}
                    >
                      Annulla
                    </CButton>
                  </div>
                </CForm>
              )}

              {testResult.test_send && (
                <div className="mt-3">
                  {testResult.test_send.success ? (
                    <CAlert color="success">
                      ✅ SMS inviato! ID: {testResult.test_send.message_id}
                    </CAlert>
                  ) : (
                    <CAlert color="danger">
                      ❌ Errore invio: {testResult.test_send.message}
                    </CAlert>
                  )}
                </div>
              )}
            </div>
          )}

          {testResult && !testResult.success && (
            <div className="mt-3">
              <h6>Risoluzione problemi:</h6>
              <ul className="small">
                <li>Verifica che BREVO_API_KEY sia configurata nel file .env</li>
                <li>Controlla che l'API key sia valida nel dashboard Brevo</li>
                <li>Assicurati di avere crediti SMS disponibili nel tuo account</li>
                <li>Verifica che il servizio Brevo sia raggiungibile</li>
              </ul>
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
              onClick={() => validateSMSConfig(Environment.TEST)}
              disabled={isTesting}
            >
              Riprova Test
            </CButton>
          )}
        </CModalFooter>
      </CModal>
    </>
  );
};

export default SMSModeSwitch;