import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CRow, CCol, CFormSwitch, CSpinner } from '@coreui/react';
import {
  getAutomationSettings,
  setAutomationSettings,
} from '@/services/api/automation-settings.service';

const RecallAutomationCard: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAutomationSettings();
      if (response.success && response.data) {
        setEnabled(response.data.recall_enabled);
      } else {
        setError(response.message || 'Errore nel recupero impostazioni richiami');
      }
    } catch (err) {
      setError('Errore di connessione nel recupero impostazioni richiami');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async () => {
    if (enabled === null) return; // Don't toggle if initial state not loaded

    setLoading(true);
    setError(null);
    try {
      const newEnabled = !enabled;
      const response = await setAutomationSettings({ recall_enabled: newEnabled });
      if (response.success) {
        setEnabled(newEnabled);
      } else {
        setError(response.message || 'Errore durante il cambio stato richiami');
      }
    } catch (err) {
      setError('Errore di connessione durante il cambio stato richiami');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CCard className='mb-3'>
      <CCardBody>
        <CRow className='align-items-center mb-3'>
          <CCol md={5}>
            <h6>Richiami</h6>
          </CCol>
          <CCol md={2}>
            <CFormSwitch
              id='calendar-sync-switch'
              checked={enabled}
              onChange={e => handleToggle()}
              label={enabled ? 'Attivato' : 'Disattivato'}
            />
          </CCol>
          <CCol md={4}>{error && <div className='text-danger'>{error}</div>}</CCol>
        </CRow>
      </CCardBody>
    </CCard>
  );
};

export default RecallAutomationCard;
