import apiClient from '@/services/api/client';

export interface EnvironmentStatus {
  service: string;
  current_environment: string;
  available_environments: string[];
  validation: {
    valid: boolean;
    warnings?: string[];
    errors?: string[];
  };
}

export interface EnvironmentResponse {
  success: boolean;
  data?: {
    service: string;
    current_environment: string;
    available_environments: string[];
    validation: {
      valid: boolean;
      warnings?: string[];
      errors?: string[];
    };
  };
  error?: string;
}

export interface SwitchEnvironmentRequest {
  environment: string;
}

export interface SwitchEnvironmentResponse {
  success: boolean;
  data?: {
    service: string;
    previous_environment: string;
    current_environment: string;
    validation: {
      valid: boolean;
      warnings?: string[];
      errors?: string[];
    };
  };
  error?: string;
}

export const environmentService = {
  // Get current environment for a service
  getServiceEnvironment: async (service: string): Promise<EnvironmentResponse> => {
    try {
      const response = await apiClient.get(`/environment/${service}/current`);
      return response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Errore recupero ambiente',
        error: error.response?.data?.error || 'ENVIRONMENT_GET_ERROR'
      };
    }
  },

  // Switch environment for a service
  switchServiceEnvironment: async (
    service: string, 
    environment: string
  ): Promise<SwitchEnvironmentResponse> => {
    try {
      const response = await apiClient.post(`/environment/${service}/switch`, {
        environment
      });
      return response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Errore cambio ambiente',
        error: error.response?.data?.error || 'ENVIRONMENT_SWITCH_ERROR'
      };
    }
  },

  // Get all services status
  getAllServicesStatus: async (): Promise<any> => {
    try {
      const response = await apiClient.get('/environment/status');
      return response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Errore recupero status servizi',
        error: error.response?.data?.error || 'SERVICES_STATUS_ERROR'
      };
    }
  }
};

export default environmentService;
