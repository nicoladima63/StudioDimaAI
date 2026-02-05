import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList, cilMediaPlay, cilMediaStop, cilSettings } from '@coreui/icons';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import CalendarAutomation from '../components/CalendarAutomation';
import RecallAutomationCard from '../components/RecallAutomationCard';
import ReminderAutomationCard from '../components/ReminderAutomationCard';
import MonitorPrestazioniService, { MonitorSummary, } from '@/services/api/monitorPrestazioni';
import MonitorRules from '../components/MonitorRules';
import ActiveWorkCard from '../components/ActiveWorkCard';
import TodoWidget from '../components/TodoWidget';
import { AutoSyncModal } from '@/features/calendar/components/AutoSyncModal';
import { calendarHealthService } from '@/features/calendar/services/calendarHealthCheck';



const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [monitorSummary, setMonitorSummary] = useState<MonitorSummary | null>(null);
  const [loading, setLoading] = useState(false);
  // Stato per il monitor selezionato (master-detail)
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);

  // Auto-sync state
  const [showAutoSyncModal, setShowAutoSyncModal] = useState(false);
  const [autoSyncJobId, setAutoSyncJobId] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
    checkFirstSync(); // Verifica se è il primo avvio
  }, []);

  const loadStatus = async () => {
    try {
      console.log('loadStatus: Fetching monitor status...');
      const response = await MonitorPrestazioniService.getStatus();
      console.log('loadStatus: API Response:', response);

      if (response.success && response.data) {
        console.log('loadStatus: Setting monitor summary to:', response.data);
        setMonitorSummary(response.data);

        // Se non c'è un monitor selezionato, seleziona il primo disponibile
        if (!selectedMonitorId && response.data.monitors) {
          const monitorIds = Object.keys(response.data.monitors);
          if (monitorIds.length > 0) {
            setSelectedMonitorId(monitorIds[0]);
          }
        }
      } else {
        console.log('loadStatus: API response not successful or no monitor data.', response);
        setMonitorSummary(null);
      }
    } catch (error) {
      console.error('loadStatus: Errore nel caricamento dello stato:', error);
      setMonitorSummary(null);
    }
  };

  const handleStartMonitorById = async (monitorId: string) => {
    const originalSummary = monitorSummary;

    // Optimistic UI update
    if (monitorSummary) {
      const newMonitors = { ...monitorSummary.monitors };
      if (newMonitors[monitorId]) {
        newMonitors[monitorId] = { ...newMonitors[monitorId], status: 'running' };
      }
      setMonitorSummary({ ...monitorSummary, monitors: newMonitors });
    }

    try {
      setLoading(true);

      const response = await MonitorPrestazioniService.startMonitor(monitorId);
      if (response.success) {
        await loadStatus(); // Resync with the server's actual state
      } else {
        if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      }
    } catch (error) {
      if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      console.error('handleStartMonitorById: Caught exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitorById = async (monitorId: string) => {
    const originalSummary = monitorSummary;

    // Optimistic UI update
    if (monitorSummary) {
      const newMonitors = { ...monitorSummary.monitors };
      if (newMonitors[monitorId]) {
        newMonitors[monitorId] = { ...newMonitors[monitorId], status: 'stopped' };
      }
      setMonitorSummary({ ...monitorSummary, monitors: newMonitors });
    }

    try {
      setLoading(true);

      const response = await MonitorPrestazioniService.stopMonitor(monitorId);
      if (response.success) {
        await loadStatus(); // Resync
      } else {
        if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      }
    } catch (error) {
      if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      console.error('handleStopMonitorById: Caught exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFirstSync = async () => {
    try {
      // Chiave per localStorage
      const STORAGE_KEY = 'calendar_first_sync_checked';

      // Verifica se il check è già stato fatto in questa sessione/browser
      const alreadyChecked = localStorage.getItem(STORAGE_KEY);
      if (alreadyChecked === 'true') {
        console.log('Calendar first sync check already performed, skipping');
        return;
      }

      // Esegui il check solo la prima volta
      const status = await calendarHealthService.checkFirstSyncStatus();

      // Memorizza che il check è stato fatto
      localStorage.setItem(STORAGE_KEY, 'true');

      // Se serve autenticazione OAuth, non fare nulla (l'utente deve autenticarsi prima)
      if (status.needs_auth) {
        console.log('OAuth authentication required, skipping auto-sync');
        return;
      }

      // Se è il primo avvio e tutto è pronto, avvia auto-sync
      if (status.needs_auto_sync) {
        console.log('First sync detected, starting auto-reset-and-sync...');
        const jobId = await calendarHealthService.startAutoResetAndSync(1); // Studio 1 default
        setAutoSyncJobId(jobId);
        setShowAutoSyncModal(true);
      }
    } catch (error) {
      console.error('Error checking first sync status:', error);
    }
  };

  const handleAutoSyncComplete = () => {
    setShowAutoSyncModal(false);
    setAutoSyncJobId(null);
  };

  // Funzione helper per resettare il flag del check (utile per debug/testing)
  const resetCalendarFirstSyncCheck = () => {
    localStorage.removeItem('calendar_first_sync_checked');
    console.log('Calendar first sync check flag reset. Reload the page to trigger a new check.');
  };

  // Esponi la funzione per debug (solo in development)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).resetCalendarCheck = resetCalendarFirstSyncCheck;
  }


  return (
    <div className='fade-in'>
      {/* Welcome header */}
      <CRow className='mb-4'>
        <CCol>
          <h1 className='h2 mb-2'>Benvenuto, {user?.username}!</h1>
          <p className='text-muted mb-0'>
            Panoramica del sistema Studio Dima V2 - Ultima connessione oggi
          </p>
        </CCol>
      </CRow>

      {/* Main Content - 2 Columns */}
      <CRow>
        {/* Left Column - Todo Widget */}
        <CCol lg={4}>
          <TodoWidget />
        </CCol>

        {/* Right Column - Active Works, Monitor, Automations */}
        <CCol lg={8}>
          {/* Active Works */}
          <CRow className="mb-4">
            <CCol>
              <ActiveWorkCard />
            </CCol>
          </CRow>

          {/* Monitor */}
          <CRow className="mb-4">
            <CCol>
              {monitorSummary && (
                <CCard>
                  <CCardHeader>
                    <CRow>
                      <CCol md={6}>
                        <h5 className='mb-0'>
                          <CIcon icon={cilList} className='me-2' />
                          Monitor Configurati ({monitorSummary.total_monitors})
                        </h5>
                      </CCol>
                      <CCol md={6} className='flex-end text-end'>
                        <NavLink
                          to='/settings/monitor-prestazioni'
                          className='btn btn-sm btn-secondary'
                        >
                          {' '}
                          <CIcon icon={cilSettings} className='me-0' />
                        </NavLink>
                      </CCol>
                    </CRow>
                  </CCardHeader>
                  <CCardBody>
                    {Object.keys(monitorSummary.monitors).length > 0 ? (
                      <CRow>
                        {Object.entries(monitorSummary.monitors).map(([monitorId, monitor]) => (
                          <CCol md={12} lg={6} key={monitorId} className='mb-3'>
                            <CCard>
                              <CCardBody>
                                <CRow className="align-items-center">
                                  <CCol xs="12">
                                    <h6 className='mb-0'>{monitor.table_name}
                                      <span className='small text-muted mb-1'> - {monitorId}</span></h6>
                                  </CCol>
                                  <CCol xs="12" className="text-end">
                                    {monitor.status === 'running' ? (
                                      <CButton
                                        color='warning'
                                        size='sm'
                                        variant='outline'
                                        onClick={() => handleStopMonitorById(monitorId)}
                                        disabled={loading}
                                        title='Ferma monitor'
                                      >
                                        <CIcon icon={cilMediaStop} />
                                      </CButton>
                                    ) : (
                                      <CButton
                                        color='success'
                                        size='sm'
                                        variant='outline'
                                        onClick={() => handleStartMonitorById(monitorId)}
                                        disabled={loading}
                                        title='Avvia monitor'
                                      >
                                        <CIcon icon={cilMediaPlay} />
                                      </CButton>
                                    )}
                                  </CCol>
                                </CRow>
                                <CRow className="mt-2">
                                  <CCol>
                                    <MonitorRules monitorId={monitorId} />
                                  </CCol>
                                </CRow>
                              </CCardBody>
                            </CCard>
                          </CCol>
                        ))}
                      </CRow>
                    ) : (
                      <p className='text-muted'>Nessun monitor configurato. Creane uno per iniziare.</p>
                    )}
                  </CCardBody>
                </CCard>
              )}
            </CCol>
          </CRow>

          {/* Automations */}
          <CRow>
            <CCol>
              <CCard>
                <CCardHeader>
                  <CRow>
                    <CCol md={6}>
                      <h5 className='mb-0'>
                        <CIcon icon={cilList} className='me-2' />
                        Automazioni Configurate
                      </h5>
                    </CCol>
                  </CRow>
                </CCardHeader>
                <CCardBody>
                  <CalendarAutomation />
                  <RecallAutomationCard />
                  <ReminderAutomationCard />
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CCol>
      </CRow>

      {/* Auto-Sync Modal */}
      <AutoSyncModal
        visible={showAutoSyncModal}
        jobId={autoSyncJobId}
        onComplete={handleAutoSyncComplete}
      />

    </div>
  );
};

export default Dashboard;

