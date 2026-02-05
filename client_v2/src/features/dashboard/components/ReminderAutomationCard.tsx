import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CRow,
  CCol,
  CFormSwitch,
} from '@coreui/react';
import {
  getAutomationSettings,
  setAutomationSettings,
} from '@/services/api/automation-settings.service';

const ReminderAutomationCard: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAutomationSettings();
      if (response.success && response.data) {
        setEnabled(response.data.reminder_enabled);
      } else {
        setError(response.message || 'Errore nel recupero impostazioni promemoria');
      }
    } catch (err) {
      setError('Errore di connessione nel recupero impostazioni promemoria');
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
      const response = await setAutomationSettings({ reminder_enabled: newEnabled });
      if (response.success) {
        setEnabled(newEnabled);
      } else {
        setError(response.message || 'Errore durante il cambio stato promemoria');
      }
    } catch (err) {
      setError('Errore di connessione durante il cambio stato promemoria');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CCard>
      <CCardBody>
        <CRow className='align-items-center mb-3'>
          <CCol md={8}>
            <CFormSwitch
              id='calendar-sync-switch'
              checked={enabled}
              onChange={e => handleToggle()}
              label={enabled ? 'Attivato' : 'Disattivato'}
            />
          </CCol>
          <CCol md={4}>
            {error && <div className='text-danger'>{error}</div>}
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  );
};

export default ReminderAutomationCard;
