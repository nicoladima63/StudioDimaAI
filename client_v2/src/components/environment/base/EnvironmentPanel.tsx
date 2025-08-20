import React, { useState } from 'react';
import {
  CCard,
  CCardHeader,
  CCardBody,
  CRow,
  CCol,
  CButton,
  CButtonGroup,
  CSpinner,
  CAlert,
  CCollapse,
  CBadge
} from '@coreui/react';
import type { 
  EnvironmentPanelProps,
  ServiceType,
  Environment
} from '../../../types/environment.types';
import { useEnvironmentBulk, useEnvironmentStatus } from '../../../store/environment.store';
import EnvironmentCard from './EnvironmentCard';

/**
 * Pannello per gestione multipla ambienti
 * Layout configurabile con azioni globali
 */
const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({
  services,
  layout = 'grid',
  showGlobalActions = true,
  title = 'Gestione Ambienti',
  collapsible = false,
  onBulkChange,
  onTestAll
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<ServiceType>>(new Set());

  const {
    bulkSwitch,
    bulkTest,
    bulkValidate,
    isProcessing,
    results
  } = useEnvironmentBulk();

  const {
    environments,
    validations,
    connectionTests,
    error
  } = useEnvironmentStatus();

  const handleServiceSelection = (service: ServiceType, selected: boolean) => {
    const newSelection = new Set(selectedServices);
    if (selected) {
      newSelection.add(service);
    } else {
      newSelection.delete(service);
    }
    setSelectedServices(newSelection);
  };

  const handleBulkEnvironmentSwitch = async (targetEnvironment: Environment) => {
    const changes: Record<ServiceType, Environment> = {};
    
    // Se nessun servizio selezionato, applica a tutti
    const servicesToChange = selectedServices.size > 0 
      ? Array.from(selectedServices) 
      : services.map(s => s.service);

    servicesToChange.forEach(service => {
      changes[service] = targetEnvironment;
    });

    try {
      const results = await bulkSwitch(changes);
      
      if (onBulkChange) {
        onBulkChange(changes);
      }

      // Reset selezione dopo cambio
      setSelectedServices(new Set());
    } catch (error) {
      console.error('Errore bulk switch:', error);
    }
  };

  const handleTestAll = async () => {
    try {
      const servicesToTest = selectedServices.size > 0 
        ? Array.from(selectedServices)
        : services.map(s => s.service);

      const testResults: Record<ServiceType, any> = {};
      
      for (const service of servicesToTest) {
        const result = await bulkTest([service]);
        Object.assign(testResults, result);
      }

      if (onTestAll) {
        onTestAll();
      }
    } catch (error) {
      console.error('Errore test all:', error);
    }
  };

  const getLayoutClass = () => {
    switch (layout) {
      case 'horizontal':
        return 'row row-cols-auto';
      case 'vertical':
        return 'row row-cols-1';
      case 'grid':
      default:
        return `row row-cols-1 row-cols-md-2 row-cols-lg-${Math.min(services.length, 3)}`;
    }
  };

  const getOverallStatus = () => {
    const total = services.length;
    const valid = services.filter(s => validations[s.service]?.valid).length;
    const connected = services.filter(s => connectionTests[s.service]?.success).length;

    return {
      total,
      valid,
      connected,
      validPercent: Math.round((valid / total) * 100),
      connectedPercent: Math.round((connected / total) * 100)
    };
  };

  const status = getOverallStatus();

  return (
    <CCard>
      <CCardHeader>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <h5 className="mb-0">{title}</h5>
            
            <div className="d-flex gap-2">
              <CBadge color="success">
                {status.connected}/{status.total} Connessi
              </CBadge>
              <CBadge color={status.valid === status.total ? 'success' : 'warning'}>
                {status.valid}/{status.total} Validi
              </CBadge>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {selectedServices.size > 0 && (
              <CBadge color="info">
                {selectedServices.size} selezionati
              </CBadge>
            )}

            {collapsible && (
              <CButton
                color="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? '▼' : '▲'}
              </CButton>
            )}
          </div>
        </div>
      </CCardHeader>

      <CCollapse visible={!isCollapsed}>
        <CCardBody>
          {error && (
            <CAlert color="danger" className="mb-3">
              {error}
            </CAlert>
          )}

          {showGlobalActions && (
            <div className="mb-4 p-3 bg-light rounded">
              <CRow className="align-items-center">
                <CCol md={6}>
                  <div className="d-flex align-items-center gap-2 mb-2 mb-md-0">
                    <span className="fw-semibold">Azioni globali:</span>
                    
                    <CButtonGroup size="sm">
                      <CButton
                        color="outline-secondary"
                        onClick={() => handleBulkEnvironmentSwitch(Environment.DEV)}
                        disabled={isProcessing}
                      >
                        → Dev
                      </CButton>
                      <CButton
                        color="outline-warning"
                        onClick={() => handleBulkEnvironmentSwitch(Environment.TEST)}
                        disabled={isProcessing}
                      >
                        → Test
                      </CButton>
                      <CButton
                        color="outline-success"
                        onClick={() => handleBulkEnvironmentSwitch(Environment.PROD)}
                        disabled={isProcessing}
                      >
                        → Prod
                      </CButton>
                    </CButtonGroup>
                  </div>
                </CCol>

                <CCol md={6}>
                  <div className="d-flex justify-content-md-end gap-2">
                    <CButton
                      color="outline-primary"
                      size="sm"
                      onClick={handleTestAll}
                      disabled={isProcessing}
                    >
                      {isProcessing && <CSpinner size="sm" className="me-1" />}
                      Test Tutti
                    </CButton>

                    <CButton
                      color="outline-info"
                      size="sm"
                      onClick={() => bulkValidate()}
                      disabled={isProcessing}
                    >
                      Valida Tutti
                    </CButton>

                    <CButton
                      color="outline-secondary"
                      size="sm"
                      onClick={() => setSelectedServices(new Set())}
                      disabled={selectedServices.size === 0}
                    >
                      Deseleziona
                    </CButton>
                  </div>
                </CCol>
              </CRow>

              {selectedServices.size > 0 && (
                <div className="mt-2 pt-2 border-top">
                  <small className="text-muted">
                    Azioni applicate a: {Array.from(selectedServices).join(', ')}
                  </small>
                </div>
              )}
            </div>
          )}

          <div className={getLayoutClass()}>
            {services.map((serviceConfig) => (
              <div key={serviceConfig.service} className="col mb-3">
                <div className="position-relative">
                  {showGlobalActions && (
                    <div className="position-absolute top-0 end-0 p-2" style={{ zIndex: 10 }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedServices.has(serviceConfig.service)}
                        onChange={(e) => handleServiceSelection(serviceConfig.service, e.target.checked)}
                        title="Seleziona per azioni bulk"
                      />
                    </div>
                  )}

                  <EnvironmentCard
                    service={serviceConfig.service}
                    title={serviceConfig.title}
                    description={serviceConfig.description}
                    badge={serviceConfig.badge}
                    showTestButton={true}
                    showStatus={true}
                    compact={layout === 'horizontal'}
                    onEnvironmentChange={(env) => {
                      // Auto-selezione se cambio individuale
                      if (!selectedServices.has(serviceConfig.service)) {
                        setSelectedServices(new Set([serviceConfig.service]));
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {isProcessing && (
            <div className="text-center mt-3">
              <CSpinner className="me-2" />
              <span className="text-muted">Elaborazione in corso...</span>
            </div>
          )}

          {results && (
            <div className="mt-3 p-3 bg-light rounded">
              <h6 className="fw-semibold mb-2">Risultati ultima operazione:</h6>
              <pre className="small mb-0">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}
        </CCardBody>
      </CCollapse>
    </CCard>
  );
};

export default EnvironmentPanel;