import { environmentApi } from './environment.service';
import type { ServiceType, Environment } from '../../types/environment.types';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  environment?: string;
  lastCheck?: string;
  details?: string;
  icon?: string;
}

export interface ServicesStatusResponse {
  success: boolean;
  data?: {
    services: Record<string, ServiceStatus>;
    overall_status: string;
    timestamp: string;
  };
  message?: string;
  error?: string;
}

export const getServicesStatus = async (): Promise<ServicesStatusResponse> => {
  try {
    const response = await environmentApi.getEnvironmentStatus();
    
    if (response.success && response.data) {
      const services: Record<string, ServiceStatus> = {};
      
      // Mappa i servizi dal backend al formato frontend
      if (response.data.services) {
        Object.entries(response.data.services).forEach(([serviceKey, serviceData]: [string, any]) => {
          const serviceName = getServiceDisplayName(serviceKey as ServiceType);
          
          // Determina lo stato del servizio
          let status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown' = 'unknown';
          let details = '';
          
          if (serviceData.validation) {
            if (serviceData.validation.valid) {
              status = 'healthy';
              details = 'Validazione: OK';
            } else if (serviceData.validation.warnings && serviceData.validation.warnings.length > 0) {
              status = 'degraded';
              details = `Avvisi: ${serviceData.validation.warnings.join(', ')}`;
            } else {
              status = 'unhealthy';
              details = `Errori: ${serviceData.validation.errors?.join(', ') || 'Validazione fallita'}`;
            }
          }
          
          services[serviceKey] = {
            name: serviceName,
            status,
            environment: serviceData.current_environment || 'unknown',
            lastCheck: new Date().toISOString(),
            details,
            icon: getServiceIcon(serviceKey as ServiceType)
          };
        });
      }

      // Aggiungi servizi di base
      services['api_server'] = {
        name: 'API Server',
        status: 'healthy',
        environment: 'active',
        details: 'Server API operativo',
        lastCheck: new Date().toISOString(),
        icon: 'server'
      };

      return {
        success: true,
        data: {
          services,
          overall_status: response.data.system_info?.status || 'healthy',
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      success: false,
      message: response.message || 'Errore nel recupero stato servizi',
      error: response.error || 'ENVIRONMENT_STATUS_ERROR'
    };

  } catch (error: any) {
    console.error('Errore nel recupero stato servizi:', error);
    
    return {
      success: false,
      message: error.message || 'Errore di connessione',
      error: 'SERVICE_STATUS_ERROR'
    };
  }
};

const getServiceDisplayName = (serviceType: ServiceType): string => {
  const names = {
    'database': 'Database',
    'ricetta': 'Ricetta Elettronica',
    'sms': 'SMS Service',
    'rentri': 'Rentri Service',
    'calendar': 'Calendar Service'
  };
  
  return names[serviceType] || serviceType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getServiceIcon = (serviceType: ServiceType): string => {
  const icons = {
    'database': 'database',
    'ricetta': 'prescription',
    'sms': 'message',
    'rentri': 'calendar',
    'calendar': 'calendar-alt'
  };
  
  return icons[serviceType] || 'gear';
};
