import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CButton, CBadge } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList, cilMediaPlay, cilMediaStop,cilSettings } from '@coreui/icons';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import ServicesStatusSection from '../components/ServicesStatusSection';
import MonitorPrestazioniService, {
  MonitorLog as BackendMonitorLog,
  MonitorSummary,
} from '@/services/api/monitorPrestazioni';
import CalendarAutomation from '../components/CalendarAutomation';


const getBadgeColor = (status: string) => {
  switch (status) {
    case 'running':
      return 'success';
    case 'error':
      return 'danger';
    case 'stopped':
    default:
      return 'secondary';
  }
};

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [monitorSummary, setMonitorSummary] = useState<MonitorSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Stato per il monitor selezionato (master-detail)
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
    //loadLogs();
    //loadActions();
    //loadRules(); // Le regole ora vengono caricate quando si seleziona un monitor
    //loadMonitorableTables();
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
      setError(null);

      const response = await MonitorPrestazioniService.startMonitor(monitorId);
      if (response.success) {
        setSuccess('Monitor avviato con successo');
        await loadStatus(); // Resync with the server's actual state
      } else {
        setError(response.message || "Errore nell'avvio del monitor");
        if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      }
    } catch (error) {
      setError("Errore nell'avvio del monitor");
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
      setError(null);

      const response = await MonitorPrestazioniService.stopMonitor(monitorId);
      if (response.success) {
        setSuccess('Monitor fermato con successo');
        await loadStatus(); // Resync
      } else {
        setError(response.message || 'Errore nella fermata del monitor');
        if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      }
    } catch (error) {
      setError('Errore nella fermata del monitor');
      if (originalSummary) setMonitorSummary(originalSummary); // Rollback
      console.error('handleStopMonitorById: Caught exception:', error);
    } finally {
      setLoading(false);
    }
  };

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

      {/* Info sections */}
      <CRow>
        <CCol lg={4}>
          {monitorSummary && (
            <CCard className='mb-4'>
              <CCardHeader>
                <CRow>
                  <CCol md={6}>
                    <h5 className='mb-0'>
                      <CIcon icon={cilList} className='me-2' />
                      Monitor Configurati ({monitorSummary.total_monitors})
                    </h5>
                  </CCol>
                  <CCol md={6} className='flex-end text-end'>
                    <NavLink to='/settings/monitor-prestazioni' className='btn btn-sm btn-secondary'> <CIcon icon={cilSettings} className='me-0' /></NavLink>
                  </CCol>
                </CRow>
              </CCardHeader>
              <CCardBody>
                {Object.keys(monitorSummary.monitors).length > 0 ? (
                  <CRow>
                    {Object.entries(monitorSummary.monitors).map(([monitorId, monitor]) => (
                      <CCol md={6} lg={6} key={monitorId} className='mb-3'>
                        <CCard>
                          <CCardBody className='d-flex flex-column'>
                            <div className='d-flex justify-content-between align-items-start mb-2'>
                              <h6 className='mb-0'>{monitor.table_name}</h6>
                            </div>
                            <p className='small text-muted mb-1'>ID: {monitorId}</p>
                            <div className='mt-auto'>
                              <div className='d-flex justify-content-between align-items-center mt-3'>
                                <div className='d-flex gap-3'>
                                  <CBadge color={getBadgeColor(monitor.status)}>
                                    {monitor.status}
                                  </CBadge>

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
                                </div>
                              </div>
                            </div>
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

        <CCol lg={4}>
          <CCard className='mb-4'>
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
              <CalendarAutomation/>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={4}>
          <CCard className='mb-4'>
            <CCardHeader>
              <h6 className='mb-0'>Prossimi sviluppi</h6>
            </CCardHeader>
            <CCardBody></CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Services Status Section */}
      <ServicesStatusSection />
    </div>
  );
};

export default Dashboard;
