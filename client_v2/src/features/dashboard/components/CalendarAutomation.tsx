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
  CCardHeader,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCalendar, cilPlus, cilX } from '@coreui/icons';
import { schedulerService } from '@/features/scheduler/services/schedulerService';
import { environmentService } from '@/features/settings/services/environment.service';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const pad = (n: number) => String(n).padStart(2, '0');

// Impostazioni calendario di settings/calendar: automazione, orari, settimane, database mode
const CalendarAutomation: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [multiTimeEnabled, setMultiTimeEnabled] = useState(false);
  const [syncTimes, setSyncTimes] = useState<string[]>([]);
  const [weeksToSync, setWeeksToSync] = useState(3);
  const [databaseMode, setDatabaseMode] = useState<'dev' | 'prod'>('prod');
  const [switchingMode, setSwitchingMode] = useState(false);
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
      setMultiTimeEnabled(settings.calendar_sync_multi_time_enabled ?? false);
      setSyncTimes(settings.calendar_sync_times || []);
      setWeeksToSync(settings.calendar_sync_weeks_to_sync ?? 3);

      const [h, m] = (settings.calendar_sync_fallback_time || '21:00').split(':').map(Number);
      setHour(h);
      setMinute(m);

      const dbResponse = await environmentService.getServiceEnvironment('database');
      if (dbResponse.success && dbResponse.data) {
        setDatabaseMode(dbResponse.data.current_environment as 'dev' | 'prod');
      }
    } catch (err: any) {
      setError('Errore nel recupero delle impostazioni');
    } finally {
      setLoading(false);
    }
  };

  const persist = (overrides: { enabled?: boolean; weeks?: number } = {}) =>
    schedulerService.apiUpdateSettings('calendar', {
      calendar_sync_enabled: overrides.enabled ?? enabled,
      calendar_sync_multi_time_enabled: multiTimeEnabled,
      calendar_sync_fallback_time: `${pad(hour)}:${pad(minute)}`,
      calendar_sync_times: syncTimes,
      calendar_weeks_to_sync: overrides.weeks ?? weeksToSync,
    });

  const handleEnabledChange = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    setSuccess(null);
    try {
      await persist({ enabled: newEnabled });
    } catch (err: any) {
      setError('Errore nel salvataggio dello stato');
      setEnabled(!newEnabled);
    }
  };

  const handleWeeksChange = async (newWeeks: number) => {
    const previous = weeksToSync;
    setWeeksToSync(newWeeks);
    setSuccess(null);
    try {
      await persist({ weeks: newWeeks });
    } catch (err: any) {
      setError('Errore nel salvataggio delle settimane');
      setWeeksToSync(previous);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await persist();
      setSuccess('Orario salvato!');
    } catch (err: any) {
      setError("Errore nel salvataggio dell'orario");
    } finally {
      setSaving(false);
    }
  };

  const handleDatabaseModeChange = async (newMode: 'dev' | 'prod') => {
    setSwitchingMode(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await environmentService.switchServiceEnvironment('database', newMode);
      if (response.success && response.data) {
        setDatabaseMode(newMode);
      } else {
        throw new Error(response.error || 'Errore nel cambio del database mode');
      }
    } catch (err: any) {
      setError(`Errore nel cambio del database mode: ${err.message}`);
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleSyncTimeChange = (index: number, part: 'hour' | 'minute', value: number) => {
    const [h, m] = syncTimes[index].split(':');
    const newTime = part === 'hour' ? `${pad(value)}:${m}` : `${h}:${pad(value)}`;
    setSyncTimes(syncTimes.map((t, i) => (i === index ? newTime : t)));
  };

  const timeSelects = (
    h: number,
    m: number,
    onHour: (v: number) => void,
    onMinute: (v: number) => void
  ) => (
    <>
      <CFormSelect value={h} onChange={e => onHour(Number(e.target.value))} style={{ width: 80 }} disabled={!enabled}>
        {HOURS.map(x => (
          <option key={x} value={x}>{pad(x)}</option>
        ))}
      </CFormSelect>
      <span className='mx-2'>:</span>
      <CFormSelect value={m} onChange={e => onMinute(Number(e.target.value))} style={{ width: 80 }} disabled={!enabled}>
        {MINUTES.map(x => (
          <option key={x} value={x}>{pad(x)}</option>
        ))}
      </CFormSelect>
    </>
  );

  return (
    <CCard>
      <CCardHeader>
        <h5 className='mb-0'>
          <CIcon icon={cilCalendar} className='me-2' />
          Sincro Calendario
        </h5>
      </CCardHeader>
      <CCardBody>
        {loading ? (
          <CSpinner color='primary' />
        ) : (
          <>
            {error && <p className='text-danger small'>{error}</p>}
            <CRow className='g-3'>
              <CCol xs={12} md={2}>
                <div className='d-flex flex-wrap align-items-center gap-2'>
                  <CFormLabel htmlFor='calendar-sync-switch' className='mb-0'>Automazione attiva</CFormLabel>
                  <CFormSwitch
                    id='calendar-sync-switch'
                    checked={enabled}
                    onChange={e => handleEnabledChange(e.target.checked)}
                    label={enabled ? 'Attiva' : 'Disattiva'}
                  />
                </div>
              </CCol>

              <CCol xs={12} md={4}>
                <div className='d-flex flex-wrap align-items-center gap-3'>
                <CFormSwitch
                  id='multi-time-switch'
                  label='Orari multipli'
                  checked={multiTimeEnabled}
                  onChange={e => setMultiTimeEnabled(e.target.checked)}
                />
                {multiTimeEnabled ? (
                  <div>
                    {syncTimes.map((time, index) => {
                      const [h, m] = time.split(':').map(Number);
                      return (
                        <div key={index} className='d-flex align-items-center mb-2'>
                          {timeSelects(
                            h,
                            m,
                            v => handleSyncTimeChange(index, 'hour', v),
                            v => handleSyncTimeChange(index, 'minute', v)
                          )}
                          <CButton
                            color='danger'
                            size='sm'
                            className='ms-2'
                            onClick={() => setSyncTimes(syncTimes.filter((_, i) => i !== index))}
                          >
                            <CIcon icon={cilX} />
                          </CButton>
                        </div>
                      );
                    })}
                    <CButton color='success' size='sm' onClick={() => setSyncTimes([...syncTimes, '09:00'])}>
                      <CIcon icon={cilPlus} className='me-1' /> Aggiungi orario
                    </CButton>
                  </div>
                ) : (
                  <div className='d-flex align-items-center' title='Orario di fallback'>
                    {timeSelects(hour, minute, setHour, setMinute)}
                  </div>
                )}
                <CButton color='primary' size='sm' onClick={handleSave} disabled={saving}>
                  {saving ? <CSpinner size='sm' /> : 'Salva Orario'}
                </CButton>
                {success && <span className='text-success small'>{success}</span>}
                </div>
              </CCol>

              <CCol xs={12} md={3}>
                <div className='d-flex flex-wrap align-items-center gap-2'>
                  <CFormLabel className='mb-0'>Settimane da sincronizzare</CFormLabel>
                  <CFormSelect
                    value={weeksToSync}
                    onChange={e => handleWeeksChange(Number(e.target.value))}
                    style={{ width: 140 }}
                  >
                    {[2, 3, 4, 6, 8].map(w => (
                      <option key={w} value={w}>{w} settimane</option>
                    ))}
                  </CFormSelect>
                </div>
              </CCol>

              <CCol xs={12} md={3}>
                <div className='d-flex flex-wrap align-items-center gap-2'>
                  <CFormLabel className='mb-0'>Database Mode</CFormLabel>
                  <CFormSwitch
                    id='database-mode-switch'
                    label={databaseMode === 'prod' ? 'PRODUZIONE' : 'SVILUPPO'}
                    checked={databaseMode === 'prod'}
                    onChange={e => handleDatabaseModeChange(e.target.checked ? 'prod' : 'dev')}
                    disabled={switchingMode}
                    color='success'
                  />
                  {switchingMode && <CSpinner size='sm' className='ms-2' />}
                </div>
              </CCol>
            </CRow>
          </>
        )}
      </CCardBody>
    </CCard>
  );
};

export default CalendarAutomation;
