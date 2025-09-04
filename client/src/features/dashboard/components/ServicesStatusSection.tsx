import React, { useState, useEffect } from 'react';
import { CCol, CRow, CButton, CSpinner, CAlert } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilReload } from '@coreui/icons';
import ServiceStatusCard from './ServiceStatusCard';
import { getServicesStatus, ServiceStatus } from '@/api/services/services-status.service';

const ServicesStatusSection: React.FC = () => {
  const [services, setServices] = useState<Record<string, ServiceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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
    
    // Refresh automatico ogni 30 secondi
    const interval = setInterval(fetchServicesStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getServiceColor = (serviceName: string): string => {
    const colors = [
      '#3399ff', '#4be38a', '#ff7676', '#8884d8', 
      '#ffa726', '#9c27b0', '#607d8b', '#795548'
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

  return (
    <div style={{ background: '#fff', padding: 20, borderRadius: 8, marginTop: 20 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 style={{ margin: 0, color: '#333' }}>Stato Servizi</h4>
          {lastUpdate && (
            <small style={{ color: '#666' }}>
              Ultimo aggiornamento: {lastUpdate.toLocaleString('it-IT')}
            </small>
          )}
        </div>
        
        <div className="d-flex align-items-center gap-2">
          {servicesCount > 0 && (
            <span style={{ 
              fontSize: 14, 
              color: '#666',
              marginRight: 10 
            }}>
              {servicesCount} servizi monitorati
            </span>
          )}
          
          <CButton 
            color="primary" 
            size="sm"
            onClick={fetchServicesStatus}
            disabled={loading}
            className="d-flex align-items-center gap-2"
          >
            {loading ? (
              <CSpinner size="sm" />
            ) : (
              <CIcon icon={cilReload} size="sm" />
            )}
            {loading ? 'Aggiornamento...' : 'Aggiorna'}
          </CButton>
        </div>
      </div>

      {error && (
        <CAlert color="danger" className="mb-3">
          {error}
        </CAlert>
      )}

      {loading && servicesCount === 0 ? (
        <div className="text-center py-4">
          <CSpinner />
          <div className="mt-2">Caricamento stato servizi...</div>
        </div>
      ) : servicesCount === 0 ? (
        <CAlert color="info">
          Nessun servizio disponibile per il monitoraggio
        </CAlert>
      ) : (
        <CRow>
          {Object.entries(services).map(([serviceKey, service]) => (
            <CCol xs={12} sm={6} lg={4} xl={3} key={serviceKey}>
              <ServiceStatusCard 
                service={service}
                color={getServiceColor(serviceKey)}
              />
            </CCol>
          ))}
        </CRow>
      )}

      {servicesCount > 0 && (
        <div className="mt-3 pt-3 border-top">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Stato Generale:</strong>
              <span className={`ms-2 badge bg-${
                overallStatus === 'healthy' ? 'success' :
                overallStatus === 'unhealthy' ? 'danger' :
                overallStatus === 'degraded' ? 'warning' : 'secondary'
              }`}>
                {overallStatus === 'healthy' ? 'Tutti i servizi operativi' :
                 overallStatus === 'unhealthy' ? 'Alcuni servizi non funzionanti' :
                 overallStatus === 'degraded' ? 'Servizi parzialmente operativi' :
                 'Stato sconosciuto'}
              </span>
            </div>
            
            <small style={{ color: '#999' }}>
              Aggiornamento automatico ogni 30 secondi
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesStatusSection;
