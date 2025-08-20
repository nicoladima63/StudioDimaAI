/**
 * Service API per gestione ambienti V2
 * Client unificato per tutti gli endpoint di environment management
 */
import apiClient from "./client";
import type {
  ApiResponse,
  EnvironmentStatusResponse,
  ServiceEnvironmentResponse,
  SwitchEnvironmentRequest,
  SwitchEnvironmentResponse,
  BulkSwitchRequest,
  BulkSwitchResponse,
  ValidationTestRequest,
  TestConnectionRequest,
  ConnectionTestResult,
  EnvironmentValidation,
  ServiceType,
  Environment
} from "../../types/environment.types";

class EnvironmentApiService {
  private readonly basePath = "/api/v2/environment";

  // === Status e informazioni ===
  async getEnvironmentStatus(): Promise<EnvironmentStatusResponse> {
    try {
      const response = await apiClient.get(`${this.basePath}/status`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'STATUS_FAILED',
        message: error.message || 'Errore recupero stato ambienti'
      };
    }
  }

  async getServiceEnvironment(service: ServiceType): Promise<ServiceEnvironmentResponse> {
    try {
      const response = await apiClient.get(`${this.basePath}/${service}/current`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'SERVICE_ENVIRONMENT_FAILED',
        message: error.message || `Errore recupero ambiente ${service}`
      };
    }
  }

  // === Switching ambienti ===
  async switchServiceEnvironment(
    service: ServiceType, 
    environment: Environment
  ): Promise<SwitchEnvironmentResponse> {
    try {
      const request: SwitchEnvironmentRequest = { environment };
      const response = await apiClient.post(`${this.basePath}/${service}/switch`, request);
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      
      return {
        success: false,
        error: errorData?.error || 'SWITCH_FAILED',
        message: errorData?.message || error.message || `Errore cambio ambiente ${service}`,
        data: errorData?.data
      };
    }
  }

  async bulkSwitchEnvironments(changes: Record<string, string>): Promise<BulkSwitchResponse> {
    try {
      const request: BulkSwitchRequest = { changes };
      const response = await apiClient.post(`${this.basePath}/bulk-switch`, request);
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      
      return {
        success: false,
        error: errorData?.error || 'BULK_SWITCH_FAILED',
        message: errorData?.message || error.message || 'Errore cambio ambienti bulk',
        data: errorData?.data
      };
    }
  }

  // === Validazione ===
  async validateServiceConfiguration(
    service: ServiceType, 
    environment?: Environment
  ): Promise<ApiResponse<{ service: string; environment: string; validation: EnvironmentValidation; message: string }>> {
    try {
      const params = environment ? { environment } : {};
      const response = await apiClient.get(`${this.basePath}/${service}/validate`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'VALIDATION_FAILED',
        message: error.message || `Errore validazione ${service}`
      };
    }
  }

  async validateAllServices(): Promise<ApiResponse<Record<string, EnvironmentValidation>>> {
    try {
      // Ottieni stato di tutti i servizi e valida ciascuno
      const statusResponse = await this.getEnvironmentStatus();
      
      if (!statusResponse.success || !statusResponse.data) {
        throw new Error('Impossibile ottenere stato servizi');
      }

      const validations: Record<string, EnvironmentValidation> = {};
      const validationPromises = Object.keys(statusResponse.data.services).map(async (service) => {
        const validation = await this.validateServiceConfiguration(service as ServiceType);
        if (validation.success && validation.data) {
          validations[service] = validation.data.validation;
        }
      });

      await Promise.all(validationPromises);

      return {
        success: true,
        data: validations
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'BULK_VALIDATION_FAILED',
        message: error.message || 'Errore validazione servizi'
      };
    }
  }

  // === Test connessioni ===
  async testServiceConnection(
    service: ServiceType, 
    environment?: Environment
  ): Promise<ApiResponse<{ service: string; environment: string; test_result: ConnectionTestResult; message: string }>> {
    try {
      const request = environment ? { environment } : {};
      const response = await apiClient.post(`${this.basePath}/${service}/test`, request);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'TEST_FAILED',
        message: error.message || `Errore test ${service}`,
        data: {
          service,
          environment: environment || 'current',
          test_result: {
            success: false,
            environment: environment || Environment.DEV,
            message: 'Test fallito',
            error: error.message
          },
          message: 'Test fallito'
        }
      };
    }
  }

  async testAllConnections(): Promise<ApiResponse<Record<string, ConnectionTestResult>>> {
    try {
      // Test tutti i servizi in parallelo
      const services = Object.values(ServiceType);
      const testResults: Record<string, ConnectionTestResult> = {};
      
      const testPromises = services.map(async (service) => {
        const result = await this.testServiceConnection(service);
        if (result.success && result.data) {
          testResults[service] = result.data.test_result;
        } else {
          testResults[service] = {
            success: false,
            environment: Environment.DEV,
            message: result.message || 'Test fallito',
            error: result.error
          };
        }
      });

      await Promise.all(testPromises);

      return {
        success: true,
        data: testResults
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'BULK_TEST_FAILED',
        message: error.message || 'Errore test connessioni'
      };
    }
  }

  // === Cache e reload ===
  async clearEnvironmentCache(): Promise<ApiResponse<{ cache_cleared: boolean; entries_removed: number; message: string }>> {
    try {
      const response = await apiClient.post(`${this.basePath}/cache/clear`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'CACHE_CLEAR_FAILED',
        message: error.message || 'Errore pulizia cache'
      };
    }
  }

  async reloadConfigurations(): Promise<ApiResponse<{ reloaded: boolean; services: any; message: string }>> {
    try {
      const response = await apiClient.post(`${this.basePath}/reload`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'RELOAD_FAILED',
        message: error.message || 'Errore reload configurazioni'
      };
    }
  }

  // === Utilities ===
  async getServiceConfiguration(service: ServiceType, environment?: Environment): Promise<ApiResponse<Record<string, any>>> {
    try {
      const serviceResponse = await this.getServiceEnvironment(service);
      
      if (serviceResponse.success && serviceResponse.data) {
        return {
          success: true,
          data: serviceResponse.data.configuration
        };
      } else {
        throw new Error(serviceResponse.message || 'Configurazione non disponibile');
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'CONFIGURATION_FAILED',
        message: error.message || `Errore configurazione ${service}`
      };
    }
  }

  async isServiceConfigured(service: ServiceType): Promise<boolean> {
    try {
      const validation = await this.validateServiceConfiguration(service);
      return validation.success && validation.data?.validation.valid || false;
    } catch {
      return false;
    }
  }

  async getAvailableEnvironments(service: ServiceType): Promise<Environment[]> {
    try {
      const serviceResponse = await this.getServiceEnvironment(service);
      
      if (serviceResponse.success && serviceResponse.data) {
        return serviceResponse.data.available_environments as Environment[];
      } else {
        // Fallback basato sul tipo di servizio
        switch (service) {
          case ServiceType.RICETTA:
          case ServiceType.SMS:
            return [Environment.TEST, Environment.PROD];
          case ServiceType.DATABASE:
          case ServiceType.RENTRI:
            return [Environment.DEV, Environment.PROD];
          default:
            return [Environment.DEV, Environment.TEST, Environment.PROD];
        }
      }
    } catch {
      return [Environment.DEV, Environment.TEST, Environment.PROD];
    }
  }

  // === Batch operations ===
  async batchOperation<T>(
    operations: Array<() => Promise<T>>,
    concurrency: number = 3
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    return results;
  }

  async healthCheck(): Promise<ApiResponse> {
    try {
      const response = await this.getEnvironmentStatus();
      return {
        success: response.success,
        message: response.success ? 'Environment service OK' : 'Environment service non disponibile',
        data: response.data ? {
          services_count: Object.keys(response.data.services).length,
          system_info: response.data.system_info
        } : undefined
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'HEALTH_CHECK_FAILED',
        message: error.message || 'Health check fallito'
      };
    }
  }

  // === Error handling helpers ===
  private handleApiError(error: any, defaultMessage: string) {
    const errorData = error.response?.data;
    
    return {
      success: false,
      error: errorData?.error || 'API_ERROR',
      message: errorData?.message || error.message || defaultMessage,
      status_code: error.response?.status
    };
  }

  // === Retry mechanism ===
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Non ritentare per errori client (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    throw lastError;
  }

  // === Specialized service methods ===
  
  // Database specific
  async testDatabaseConnection(environment?: Environment): Promise<ConnectionTestResult> {
    const result = await this.testServiceConnection(ServiceType.DATABASE, environment);
    return result.data?.test_result || {
      success: false,
      environment: environment || Environment.DEV,
      message: 'Test fallito',
      error: result.error
    };
  }

  // SMS specific
  async testSMSConnection(environment?: Environment): Promise<ConnectionTestResult> {
    const result = await this.testServiceConnection(ServiceType.SMS, environment);
    return result.data?.test_result || {
      success: false,
      environment: environment || Environment.TEST,
      message: 'Test fallito',
      error: result.error
    };
  }

  // Ricetta specific
  async testRicettaConnection(environment?: Environment): Promise<ConnectionTestResult> {
    const result = await this.testServiceConnection(ServiceType.RICETTA, environment);
    return result.data?.test_result || {
      success: false,
      environment: environment || Environment.TEST,
      message: 'Test fallito',
      error: result.error
    };
  }

  // Rentri specific
  async testRentriConnection(environment?: Environment): Promise<ConnectionTestResult> {
    const result = await this.testServiceConnection(ServiceType.RENTRI, environment);
    return result.data?.test_result || {
      success: false,
      environment: environment || Environment.DEV,
      message: 'Test fallito',
      error: result.error
    };
  }
}

// Instance singleton
export const environmentApi = new EnvironmentApiService();

// Export default per compatibilità
export default environmentApi;

// Named exports per funzioni specifiche
export const {
  getEnvironmentStatus,
  getServiceEnvironment,
  switchServiceEnvironment,
  bulkSwitchEnvironments,
  validateServiceConfiguration,
  validateAllServices,
  testServiceConnection,
  testAllConnections,
  clearEnvironmentCache,
  reloadConfigurations,
  healthCheck
} = environmentApi;