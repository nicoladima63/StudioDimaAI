import React, { useState, useEffect } from 'react';
import {
  CCol,
  CRow,
  CButton,
  CSpinner,
  CAlert,
  CCard,
  CCardHeader,
  CCardBody,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilReload } from '@coreui/icons';
import ServiceStatusCard from './ServiceStatusCard';
import { getServicesStatus, ServiceStatus } from '@/services/api/services-status.service';
import { useNavigate } from 'react-router-dom';
import { environmentService } from '@/features/settings/services/environment.service';
import { environmentApi } from '@/services/api/environment.service';

const ServicesStatusSection: React.FC = () => {
  const [services, setServices] = useState<Record<string, ServiceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const navigate = useNavigate();

  const fetchServicesStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getServicesStatus();

      if (response.success && response.data) {
        setServices(response.data.services);
        setLastUpdate(new Date());
      } else {
        setError(response.message || 'Errore nel recupero stato servizi');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicesStatus();
    // Rimosso refresh automatico per permettere test configurazioni
  }, []);

  const getServiceColor = (serviceName: string): string => {
    const colors = [
      '#3399ff',
      '#4be38a',
      '#ff7676',
      '#8884d8',
      '#ffa726',
      '#9c27b0',
      '#607d8b',
      '#795548',
    ];

    const index = serviceName.length % colors.length;
    return colors[index];
  };

  const getOverallStatus = () => {
    const statuses = Object.values(services).map(s => s.status);

    if (statuses.length === 0) return 'unknown';
    if (statuses.every(s => s === 'healthy')) return 'healthy';
    if (statuses.some(s => s === 'unhealthy')) return 'unhealthy';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'unknown';
  };

  const overallStatus = getOverallStatus();
  const servicesCount = Object.keys(services).length;

  // Funzioni per gestire le azioni delle card
  const handleToggleService = async (serviceKey: string, enabled: boolean) => {
    try {
      // TODO: Implementare chiamata API per toggle servizio
      console.log(`Toggle ${serviceKey} to ${enabled}`);
      const response = await environmentApi.switchServiceEnvironment(serviceKey, enabled ? 'prod' : 'dev');
      if (response.success) {
        setServices(prev => ({
          ...prev,
          [serviceKey]: {
            ...prev[serviceKey],
            status: enabled ? 'healthy' : 'unhealthy',
          },
        }));
      }
    } catch (error) {
      console.error('Errore toggle servizio:', error);
    }
  };

  const handleOpenSettings = (serviceKey: string) => {
    const routeMap: Record<string, string> = {
      sms: '/settings/sms',
      rentri: '/settings/rentri',
      ricetta_elettronica: '/settings/ricetta',
      calendar: '/settings/calendar',
    };

    const route = routeMap[serviceKey];
    if (route) {
      navigate(route);
    }
  };

  const handleForceFallback = async (serviceKey: string) => {
    try {
      console.log(`Forzando fallback a DEV per ${serviceKey}`);
      const response = await environmentService.switchServiceEnvironment(serviceKey, 'dev');
      if (response.success) {
        // Ricarica lo status dei servizi
        await fetchServicesStatus();
      }
    } catch (error) {
      console.error('Errore fallback automatico:', error);
    }
  };

  return (
    <CCard className='mb-4'>
      <CCardHeader>
        <div className='d-flex justify-content-between align-items-center'>
          <h5 className='mb-0'>Stato Servizi</h5>
          <div className='d-flex align-items-center gap-2'>
            {servicesCount > 0 && (
              <span className='small text-muted'>{servicesCount} servizi monitorati</span>
            )}

            <CButton
              color='primary'
              size='sm'
              onClick={fetchServicesStatus}
              disabled={loading}
              className='d-flex align-items-center gap-2'
            >
              {loading ? <CSpinner size='sm' /> : <CIcon icon={cilReload} size='sm' />}
              {loading ? 'Aggiornamento...' : 'Aggiorna'}
            </CButton>
          </div>
        </div>

        {lastUpdate && (
          <small className='text-muted'>
            Ultimo aggiornamento: {lastUpdate.toLocaleString('it-IT')}
          </small>
        )}
      </CCardHeader>

      <CCardBody>
        {error && (
          <CAlert color='danger' className='mb-3'>
            {error}
          </CAlert>
        )}

        {loading && servicesCount === 0 ? (
          <div className='text-center py-4'>
            <CSpinner />
            <div className='mt-2'>Caricamento stato servizi...</div>
          </div>
        ) : servicesCount === 0 ? (
          <CAlert color='info'>Nessun servizio disponibile per il monitoraggio</CAlert>
        ) : (
          <>
            <CRow className='justify-content-center'>
              {Object.entries(services).map(([serviceKey, service]) => (
                <CCol xs={12} sm={6} lg={4} xl={2} key={serviceKey}>
                  <ServiceStatusCard
                    service={service}
                    color={getServiceColor(serviceKey)}
                    onToggleService={handleToggleService}
                    onOpenSettings={handleOpenSettings}
                    onForceFallback={handleForceFallback}
                  />
                </CCol>
              ))}
            </CRow>

            <div className='mt-3 pt-3 border-top'>
              <div className='d-flex justify-content-between align-items-center'>
                <div>
                  <strong>Stato Generale:</strong>
                  <span
                    className={`ms-2 badge bg-${
                      overallStatus === 'healthy'
                        ? 'success'
                        : overallStatus === 'unhealthy'
                          ? 'danger'
                          : overallStatus === 'degraded'
                            ? 'warning'
                            : 'secondary'
                    }`}
                  >
                    {overallStatus === 'healthy'
                      ? 'Tutti i servizi operativi'
                      : overallStatus === 'unhealthy'
                        ? 'Alcuni servizi non funzionanti'
                        : overallStatus === 'degraded'
                          ? 'Servizi parzialmente operativi'
                          : 'Stato sconosciuto'}
                  </span>
                </div>

                <small className='text-muted'>Aggiornamento automatico ogni 30 secondi</small>
              </div>
            </div>
          </>
        )}
      </CCardBody>
    </CCard>
  );
};

export default ServicesStatusSection;
