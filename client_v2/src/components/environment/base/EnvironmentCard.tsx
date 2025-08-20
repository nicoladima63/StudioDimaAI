import React, { useState } from 'react';
import {
  CCard,
  CCardHeader,
  CCardBody,
  CCardFooter,
  CButton,
  CBadge,
  CSpinner,
  CAlert,
  CRow,
  CCol
} from '@coreui/react';
import type { 
  EnvironmentCardProps, 
  Environment,
  SERVICE_DISPLAY_NAMES,
  ENVIRONMENT_DISPLAY_NAMES,
  ENVIRONMENT_COLORS
} from '../../../types/environment.types';
import { useEnvironmentSwitch, useEnvironmentTest } from '../../../store/environment.store';
import EnvironmentSwitch from './EnvironmentSwitch';

/**
 * Card completa per gestione ambiente servizio
 * Include switch, stato, validazione e test
 */
const EnvironmentCard: React.FC<EnvironmentCardProps> = ({
  service,
  title,
  description,
  badge,
  showTestButton = true,
  showStatus = true,
  compact = false,
  onEnvironmentChange,
  onTest
}) => {
  const {
    currentEnvironment,
    isLoading,
    isValid,
    config
  } = useEnvironmentSwitch(service);

  const {
    testResult,
    isTesting,
    test,
    isConnected
  } = useEnvironmentTest();

  const [showDetails, setShowDetails] = useState(false);

  const handleEnvironmentChange = (environment: Environment) => {
    if (onEnvironmentChange) {
      onEnvironmentChange(environment);
    }
  };

  const handleTest = async () => {
    try {
      const result = await test(service);
      if (onTest) {
        onTest();
      }
    } catch (error) {
      console.error('Errore test:', error);
    }
  };

  const getBadgeConfig = () => {
    if (badge) {
      if (isConnected(service)) return { color: 'success', text: badge.success };
      if (!isValid) return { color: 'danger', text: badge.danger };
      return { color: 'warning', text: badge.warning };
    }

    // Badge default
    if (isConnected(service)) return { color: 'success', text: '✓ Connesso' };
    if (!isValid) return { color: 'danger', text: '✗ Non valido' };
    return { color: 'warning', text: '⚠ Non testato' };
  };

  const badgeConfig = getBadgeConfig();

  const getStatusIcon = () => {
    if (isConnected(service)) return '🟢';
    if (!isValid) return '🔴';
    return '🟡';
  };

  if (compact) {
    return (
      <CCard className="h-100">
        <CCardBody className="p-3">
          <CRow className="align-items-center">
            <CCol xs={6}>
              <div className="d-flex align-items-center gap-2">
                <span className="fw-semibold">{title}</span>
                {showStatus && (
                  <CBadge color={badgeConfig.color} className="ms-1">
                    {getStatusIcon()}
                  </CBadge>
                )}
              </div>
            </CCol>
            <CCol xs={6}>
              <EnvironmentSwitch
                service={service}
                showLabel={false}
                size="sm"
                onModeChange={handleEnvironmentChange}
              />
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>
    );
  }

  return (
    <CCard className="h-100">
      <CCardHeader>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0">{title}</h6>
            {showStatus && (
              <CBadge color={badgeConfig.color}>
                {badgeConfig.text}
              </CBadge>
            )}
          </div>
          <CBadge 
            color={ENVIRONMENT_COLORS[currentEnvironment]}
            className="text-uppercase"
          >
            {ENVIRONMENT_DISPLAY_NAMES[currentEnvironment]}
          </CBadge>
        </div>
      </CCardHeader>

      <CCardBody>
        {description && (
          <p className="text-muted mb-3 small">{description}</p>
        )}

        <div className="mb-3">
          <EnvironmentSwitch
            service={service}
            label="Ambiente:"
            onModeChange={handleEnvironmentChange}
          />
        </div>

        {showStatus && (
          <div className="border-top pt-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small fw-semibold">Stato configurazione:</span>
              <CBadge color={isValid ? 'success' : 'danger'}>
                {isValid ? 'Valida' : 'Non valida'}
              </CBadge>
            </div>

            {testResult && (
              <div className="d-flex justify-content-between align-items-center">
                <span className="small fw-semibold">Ultimo test:</span>
                <CBadge color={testResult.success ? 'success' : 'danger'}>
                  {testResult.success ? 'OK' : 'Fallito'}
                </CBadge>
              </div>
            )}
          </div>
        )}

        {!isValid && (
          <CAlert color="warning" className="mt-3 mb-0 small">
            Configurazione non valida per ambiente {ENVIRONMENT_DISPLAY_NAMES[currentEnvironment]}
          </CAlert>
        )}

        {showDetails && config && (
          <div className="mt-3 border-top pt-3">
            <h6 className="small fw-semibold mb-2">Configurazione:</h6>
            <pre className="small text-muted bg-light p-2 rounded">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        )}
      </CCardBody>

      {(showTestButton || Object.keys(config || {}).length > 0) && (
        <CCardFooter>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex gap-2">
              {showTestButton && (
                <CButton
                  color="outline-primary"
                  size="sm"
                  onClick={handleTest}
                  disabled={isTesting || isLoading}
                >
                  {isTesting && <CSpinner size="sm" className="me-1" />}
                  Test Connessione
                </CButton>
              )}

              {Object.keys(config || {}).length > 0 && (
                <CButton
                  color="outline-secondary"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? 'Nascondi' : 'Mostra'} Dettagli
                </CButton>
              )}
            </div>

            {(isLoading || isTesting) && (
              <div className="d-flex align-items-center gap-2 text-muted">
                <CSpinner size="sm" />
                <span className="small">
                  {isLoading ? 'Caricamento...' : 'Test in corso...'}
                </span>
              </div>
            )}
          </div>
        </CCardFooter>
      )}
    </CCard>
  );
};

export default EnvironmentCard;