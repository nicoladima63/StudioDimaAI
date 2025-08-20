import React, { useState } from 'react';
import { CAlert, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CButton, CSpinner } from '@coreui/react';
import { ServiceType, Environment } from '../../../types/environment.types';
import { EnvironmentCard } from '../base';
import { useEnvironmentTest } from '../../../store/environment.store';

/**
 * Componente specializzato per switch ambiente database
 * Include validazione rete studio per ambiente PROD
 */
const DatabaseModeSwitch: React.FC = () => {
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [networkMessage, setNetworkMessage] = useState('');
  const [isTestingNetwork, setIsTestingNetwork] = useState(false);

  const { test } = useEnvironmentTest();

  const validateNetworkSwitch = async (targetEnvironment: Environment): Promise<boolean> => {
    if (targetEnvironment !== Environment.PROD) {
      return true; // Switch a DEV sempre permesso
    }

    setIsTestingNetwork(true);
    setNetworkMessage('Verifica connessione alla rete studio...');
    setShowNetworkModal(true);

    try {
      // Test connessione database rete
      const testResult = await test(ServiceType.DATABASE, Environment.PROD);

      if (testResult.success) {
        setNetworkMessage('Rete studio raggiungibile. Switch abilitato.');
        setIsTestingNetwork(false);
        
        // Chiudi modal dopo successo
        setTimeout(() => {
          setShowNetworkModal(false);
        }, 1500);
        
        return true;
      } else {
        const errorMessage = testResult.details?.network_connectivity === false
          ? 'Server SERVERDIMA non raggiungibile. Assicurati di essere connesso alla rete studio.'
          : testResult.details?.share_accessible === false
          ? 'Cartella condivisa non accessibile. Verifica le credenziali di rete.'
          : 'Errore connessione database rete studio.';

        setNetworkMessage(errorMessage);
        setIsTestingNetwork(false);
        return false;
      }
    } catch (error: any) {
      setNetworkMessage(`Errore test rete: ${error.message}`);
      setIsTestingNetwork(false);
      return false;
    }
  };

  const handleEnvironmentChange = (environment: Environment) => {
    console.log(`Database ambiente cambiato a: ${environment}`);
  };

  const handleTest = () => {
    console.log('Test database avviato');
  };

  return (
    <>
      <EnvironmentCard
        service={ServiceType.DATABASE}
        title="Database"
        description="Gestione database locale (casa) o rete studio"
        badge={{
          success: '🏢 Studio',
          warning: '🏠 Casa', 
          danger: '❌ Errore'
        }}
        showTestButton={true}
        showStatus={true}
        onEnvironmentChange={handleEnvironmentChange}
        onTest={handleTest}
      />

      <CModal
        visible={showNetworkModal}
        onClose={() => !isTestingNetwork && setShowNetworkModal(false)}
        backdrop={isTestingNetwork ? 'static' : true}
        keyboard={!isTestingNetwork}
      >
        <CModalHeader>
          <CModalTitle>Verifica Rete Studio</CModalTitle>
        </CModalHeader>
        
        <CModalBody>
          <div className="d-flex align-items-center gap-3 mb-3">
            {isTestingNetwork && <CSpinner size="sm" />}
            <span>{networkMessage}</span>
          </div>

          {networkMessage.includes('non raggiungibile') && (
            <CAlert color="warning" className="mb-0">
              <strong>Cosa fare:</strong>
              <ul className="mb-0 mt-2">
                <li>Verifica di essere connesso alla rete dello studio</li>
                <li>Prova a accedere alla cartella: <code>\\SERVERDIMA\Pixel\WINDENT</code></li>
                <li>Se richiesto, inserisci le credenziali di rete</li>
                <li>Contatta l'amministratore se il problema persiste</li>
              </ul>
            </CAlert>
          )}

          {networkMessage.includes('cartella condivisa') && (
            <CAlert color="warning" className="mb-0">
              <strong>Accesso cartella condivisa:</strong>
              <ul className="mb-0 mt-2">
                <li>Verifica le credenziali di accesso alla rete</li>
                <li>Prova a fare login manualmente alla risorsa di rete</li>
                <li>Assicurati di avere i permessi per accedere a WINDENT</li>
              </ul>
            </CAlert>
          )}

          {networkMessage.includes('raggiungibile') && networkMessage.includes('abilitato') && (
            <CAlert color="success" className="mb-0">
              ✅ Connessione verificata! Il database di studio è accessibile.
            </CAlert>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowNetworkModal(false)}
            disabled={isTestingNetwork}
          >
            {isTestingNetwork ? 'Test in corso...' : 'Chiudi'}
          </CButton>
          
          {!isTestingNetwork && networkMessage.includes('non raggiungibile') && (
            <CButton
              color="primary"
              onClick={() => validateNetworkSwitch(Environment.PROD)}
            >
              Riprova Test
            </CButton>
          )}
        </CModalFooter>
      </CModal>
    </>
  );
};

export default DatabaseModeSwitch;