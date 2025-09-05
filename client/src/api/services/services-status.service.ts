import { apiClient } from '@/api/client';

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
    const response = await apiClient.get('/api/v2/health');
    
    if (response.status === 200) {
      const data = response.data;
      
      // Mappa i servizi dal backend al formato frontend
      const services: Record<string, ServiceStatus> = {};
      
      if (data.services) {
        Object.entries(data.services).forEach(([serviceName, serviceData]: [string, any]) => {
          services[serviceName] = {
            name: serviceData.name || serviceName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            status: serviceData.status || 'unknown',
            environment: serviceData.environment,
            lastCheck: serviceData.last_check || data.timestamp,
            details: serviceData.details || serviceData.message,
            icon: serviceData.icon
          };
        });
      }

      return {
        success: true,
        data: {
          services,
          overall_status: data.status || 'unknown',
          timestamp: data.timestamp
        }
      };
    }

    return {
      success: false,
      message: 'Errore nella risposta del server',
      error: 'INVALID_RESPONSE'
    };

  } catch (error: any) {
    console.error('Errore nel recupero stato servizi:', error);
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Errore di connessione',
      error: 'SERVICE_STATUS_ERROR'
    };
  }
};

export const getIndividualServiceStatus = async (serviceName: string): Promise<ServiceStatus | null> => {
  try {
    const response = await apiClient.get(`/api/v2/${serviceName}/health`);
    
    if (response.status === 200) {
      const data = response.data;
      
      return {
        name: serviceName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status: data.status || 'unknown',
        environment: data.environment,
        lastCheck: data.timestamp,
        details: data.details || data.message,
        icon: data.icon
      };
    }

    return null;

  } catch (error: any) {
    console.error(`Errore nel recupero stato servizio ${serviceName}:`, error);
    return null;
  }
};