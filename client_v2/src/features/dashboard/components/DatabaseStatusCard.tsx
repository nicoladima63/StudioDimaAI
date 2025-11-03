import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCol, CRow, CButton, CBadge, CSpinner } from '@coreui/react';
import { getDatabaseStatus, toggleDatabaseMode } from '@/services/api/environment.service';

const DatabaseStatusCard: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const dbStatus = await getDatabaseStatus();
      setStatus(dbStatus);
    } catch (err) {
      setError('Errore nel recupero dello stato del database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await toggleDatabaseMode();
      fetchStatus(); // Refresh status after toggle
    } catch (err) {
      setError('Errore durante il cambio di ambiente');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!status || !status.current_environment) return 'secondary';
    return status.current_environment.toLowerCase() === 'prod' ? 'success' : 'warning';
  };

  return (
    <CCard className='mb-3'>
      <CCardBody>
        <CRow className='align-items-center mb-3'>
          <CCol xs={6}>
            <h6>Percorsi Database:</h6>
          </CCol>
          <CCol xs={6}>
            {status && (
              <div className='d-flex justify-content-between align-items-center'>
                <CButton onClick={handleToggle} disabled={loading} size='lg'>
                  <CBadge color={getStatusColor()} className='ms-2'>
                    {loading && <CSpinner size='sm' />}
                    {status.current_environment?.toLowerCase() === 'prod'
                      ? 'Studio'
                      : 'Notebook'}
                  </CBadge>
                </CButton>
              </div>
            )}
            {error && <div className='text-danger'>{error}</div>}
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  );
};

export default DatabaseStatusCard;
