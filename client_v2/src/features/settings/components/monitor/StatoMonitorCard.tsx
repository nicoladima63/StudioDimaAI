
import React from 'react';
import { CCard, CCardBody, CCardHeader, CRow, CCol, CButton, CSpinner, CBadge, CAlert } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilMediaPlay, cilMediaStop, cilSettings } from '@coreui/icons';

interface MonitorStatus {
  is_running: boolean;
  path: string;
  last_check?: string;
  total_changes: number;
}

interface StatoMonitorCardProps {
  status: MonitorStatus | null;
  loading: boolean;
  error: string | null;
  success: string | null;
  onStart: () => void;
  onStop: () => void;
  onTest: () => void;
  onClearError: () => void;
  onClearSuccess: () => void;
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('it-IT');
};

const StatoMonitorCard: React.FC<StatoMonitorCardProps> = ({
  status,
  loading,
  error,
  success,
  onStart,
  onStop,
  onTest,
  onClearError,
  onClearSuccess,
}) => {
  return (
    <CCard className='mb-4'>
      <CCardHeader>
        <h5 className='mb-0'>
          <CIcon icon={cilSettings} className='me-2' />
          Impostazioni Monitor
        </h5>
      </CCardHeader>
      <CCardBody>
        <CRow>
          {/* Pulsanti di controllo */}
          <CCol md={8}>
            <div className='d-flex align-items-center gap-2'>
              {status?.is_running ? (
                <CButton 
                  color='warning'
                  onClick={onStop} 
                  disabled={loading}
                  size='sm'
                >
                  {loading ? (
                    <CSpinner size='sm' className='me-1' />
                  ) : (
                    <CIcon icon={cilMediaStop} className='me-1' />
                  )}
                  Ferma Monitor
                </CButton>
              ) : (
                <CButton 
                  color='success'
                  onClick={onStart} 
                  disabled={loading}
                  size='sm'
                >
                  {loading ? (
                    <CSpinner size='sm' className='me-1' />
                  ) : (
                    <CIcon icon={cilMediaPlay} className='me-1' />
                  )}
                  Avvia Monitor
                </CButton>
              )}
              {/* Stato e statistiche */}
              {status?.is_running ? (
                <CBadge color='success' className='fs-6'>
                  <CIcon icon={cilMediaPlay} className='me-1' />
                  Attivo
                </CBadge>
              ) : (
                <CBadge color='secondary' className='fs-6'>
                  <CIcon icon={cilMediaStop} className='me-1' />
                  Fermato
                </CBadge>
              )}
              {status && (
                <div className='small text-muted'>
                  <div>
                    Cambiamenti: <strong>{status.total_changes}</strong>
                  </div>
                  {status.last_check && (
                    <div>
                      Ultimo: <strong>{formatTimestamp(status.last_check)}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CCol>

          {/* Toast per messaggi */}
          <CCol md={4}>
            {error && (
              <CAlert
                color='danger'
                className='mb-2'
                onClose={onClearError}
                dismissible
              >
                {error}
              </CAlert>
            )}

            {success && (
              <CAlert
                color='success'
                className='mb-2'
                onClose={onClearSuccess}
                dismissible
              >
                {success}
              </CAlert>
            )}
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  );
};

export default StatoMonitorCard;
