import React, { useEffect, useState } from 'react';
import {
  CFormSwitch,
  CFormLabel,
  CRow,
  CCol,
  CButton,
  CFormSelect,
  CSpinner,
  CCard,
  CCardBody,
} from '@coreui/react';
import { NavLink } from 'react-router-dom';
import CIcon from '@coreui/icons-react';
import { cilSettings } from '@coreui/icons';
import { schedulerService } from '@/features/scheduler/services/schedulerService';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const CalendarAutomation: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await schedulerService.apiGetStatus();
      const settings = response.settings;

      setEnabled(settings.calendar_sync_enabled);

      // Parse fallback_time "HH:MM" to hour and minute
      const fallbackTime = settings.calendar_sync_fallback_time || "21:00";
      const [h, m] = fallbackTime.split(':').map(Number);
      setHour(h);
      setMinute(m);
    } catch (err: any) {
      setError('Errore nel recupero delle impostazioni');
    } finally {
      setLoading(false);
    }
  };

  const handleEnabledChange = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    try {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      await schedulerService.apiUpdateSettings('calendar', {
        calendar_sync_enabled: newEnabled,
        calendar_sync_fallback_time: timeStr,
        calendar_sync_times: [timeStr],
      });
    } catch (err: any) {
      setError('Errore nel salvataggio dello stato');
      setEnabled(!newEnabled);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      await schedulerService.apiUpdateSettings('calendar', {
        calendar_sync_enabled: enabled,
        calendar_sync_fallback_time: timeStr,
        calendar_sync_times: [timeStr],
      });
      setSuccess('Orario salvato!');
    } catch (err: any) {
      setError("Errore nel salvataggio dell'orario");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CSpinner color='primary' />;
  }

  if (error) {
    return <p className='text-danger'>{error}</p>;
  }

  return (
    <CCard className='mb-3'>
      <CCardBody className='d-flex flex-column'>
        <CRow className='align-items-center mb-3'>
          <CCol md={3}>
            <CFormSwitch
              id='calendar-sync-switch'
              checked={enabled}
              onChange={e => handleEnabledChange(e.target.checked)}
              label={enabled ? 'Attiva' : 'Disattiva'}
            />
          </CCol>
          <CCol md={5}>
            <div className='d-flex gap-2 align-items-center'>
              <CFormSelect
                value={hour}
                onChange={e => setHour(Number(e.target.value))}
                style={{ width: 80 }}
                disabled={!enabled}
              >
                {HOURS.map(h => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, '0')}
                  </option>
                ))}
              </CFormSelect>
              <span>:</span>
              <CFormSelect
                value={minute}
                onChange={e => setMinute(Number(e.target.value))}
                style={{ width: 80 }}
                disabled={!enabled}
              >
                {MINUTES.map(m => (
                  <option key={m} value={m}>
                    {m.toString().padStart(2, '0')}
                  </option>
                ))}
              </CFormSelect>
              <CButton color='primary' size='sm' onClick={handleSave} disabled={saving || !enabled}>
                {saving ? <CSpinner size='sm' /> : 'Salva'}
              </CButton>
            </div>
          </CCol>
          <CCol md={2} className='flex-end text-end'>
            <NavLink to='/settings/calendar' className='btn btn-sm btn-secondary'>
              <CIcon icon={cilSettings} className='me-0' />
            </NavLink>
          </CCol>
        </CRow>
        {success && <p className='text-success small mt-2'>{success}</p>}
      </CCardBody>
    </CCard>
  );
};

export default CalendarAutomation;
