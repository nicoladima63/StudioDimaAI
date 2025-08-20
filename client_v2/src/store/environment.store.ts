import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  EnvironmentStoreState,
  EnvironmentStoreActions,
  Environment,
  ServiceType,
  EnvironmentValidation,
  ConnectionTestResult,
  ServiceStatus,
  DEFAULT_ENVIRONMENT_CONFIG
} from "../types/environment.types";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface EnvironmentStore extends EnvironmentStoreState, EnvironmentStoreActions {}

export const useEnvironmentStore = create<EnvironmentStore>()(
  persist(
    (set, get) => ({
      // === State iniziale ===
      environments: {
        [ServiceType.DATABASE]: Environment.DEV,
        [ServiceType.RICETTA]: Environment.TEST,
        [ServiceType.SMS]: Environment.TEST,
        [ServiceType.RENTRI]: Environment.DEV
      },

      configurations: {
        [ServiceType.DATABASE]: {},
        [ServiceType.RICETTA]: {},
        [ServiceType.SMS]: {},
        [ServiceType.RENTRI]: {}
      },

      validations: {
        [ServiceType.DATABASE]: { valid: false, errors: [], warnings: [], checks: {} },
        [ServiceType.RICETTA]: { valid: false, errors: [], warnings: [], checks: {} },
        [ServiceType.SMS]: { valid: false, errors: [], warnings: [], checks: {} },
        [ServiceType.RENTRI]: { valid: false, errors: [], warnings: [], checks: {} }
      },

      isLoading: false,
      error: null,

      lastUpdated: {
        [ServiceType.DATABASE]: 0,
        [ServiceType.RICETTA]: 0,
        [ServiceType.SMS]: 0,
        [ServiceType.RENTRI]: 0
      },

      connectionTests: {
        [ServiceType.DATABASE]: null,
        [ServiceType.RICETTA]: null,
        [ServiceType.SMS]: null,
        [ServiceType.RENTRI]: null
      },

      configCache: {},
      cacheTimestamps: {},

      // === Environment Management ===
      getEnvironment: (service: ServiceType) => {
        return get().environments[service];
      },

      setEnvironment: async (service: ServiceType, environment: Environment): Promise<boolean> => {
        try {
          set({ isLoading: true, error: null });

          const { environmentApi } = await import("../services/api/environment.service");
          const response = await environmentApi.switchServiceEnvironment(service, environment);

          if (response.success) {
            set(state => ({
              environments: {
                ...state.environments,
                [service]: environment
              },
              lastUpdated: {
                ...state.lastUpdated,
                [service]: Date.now()
              },
              isLoading: false
            }));

            // Invalida cache per questo servizio
            get().invalidateServiceCache(service);

            // Ricarica configurazione
            await get().loadServiceConfig(service, environment);

            return true;
          } else {
            set({ 
              error: response.message || 'Errore cambio ambiente',
              isLoading: false 
            });
            return false;
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Errore cambio ambiente',
            isLoading: false 
          });
          return false;
        }
      },

      bulkSetEnvironments: async (changes: Record<ServiceType, Environment>): Promise<Record<ServiceType, boolean>> => {
        try {
          set({ isLoading: true, error: null });

          const { environmentApi } = await import("../services/api/environment.service");
          
          // Converte enum in stringhe per API
          const apiChanges: Record<string, string> = {};
          Object.entries(changes).forEach(([service, env]) => {
            apiChanges[service] = env;
          });

          const response = await environmentApi.bulkSwitchEnvironments(apiChanges);

          if (response.success && response.data) {
            const results: Record<ServiceType, boolean> = {} as Record<ServiceType, boolean>;
            
            // Aggiorna state per cambi riusciti
            const newEnvironments = { ...get().environments };
            const newLastUpdated = { ...get().lastUpdated };

            Object.entries(response.data.results).forEach(([serviceStr, result]) => {
              const service = serviceStr as ServiceType;
              results[service] = result.success;
              
              if (result.success) {
                newEnvironments[service] = changes[service];
                newLastUpdated[service] = Date.now();
                get().invalidateServiceCache(service);
              }
            });

            set({
              environments: newEnvironments,
              lastUpdated: newLastUpdated,
              isLoading: false
            });

            // Ricarica configurazioni per servizi modificati
            const reloadPromises = Object.entries(results)
              .filter(([_, success]) => success)
              .map(([service, _]) => get().loadServiceConfig(service as ServiceType));

            await Promise.all(reloadPromises);

            return results;
          } else {
            set({ 
              error: response.message || 'Errore cambio ambienti bulk',
              isLoading: false 
            });
            return Object.fromEntries(
              Object.keys(changes).map(service => [service as ServiceType, false])
            ) as Record<ServiceType, boolean>;
          }
        } catch (error: any) {
          set({ 
            error: error.message || 'Errore cambio ambienti bulk',
            isLoading: false 
          });
          return Object.fromEntries(
            Object.keys(changes).map(service => [service as ServiceType, false])
          ) as Record<ServiceType, boolean>;
        }
      },

      // === Configuration Management ===
      loadServiceConfig: async (service: ServiceType, environment?: Environment): Promise<void> => {
        try {
          const env = environment || get().getEnvironment(service);
          const cacheKey = `${service}_${env}_config`;
          
          // Controlla cache
          if (get()._isCacheValid(cacheKey)) {
            return;
          }

          const { environmentApi } = await import("../services/api/environment.service");
          const response = await environmentApi.getServiceEnvironment(service);

          if (response.success && response.data) {
            set(state => ({
              configurations: {
                ...state.configurations,
                [service]: response.data.configuration
              },
              validations: {
                ...state.validations,
                [service]: response.data.validation
              }
            }));

            // Aggiorna cache
            get()._setCache(cacheKey, response.data.configuration);
          }
        } catch (error: any) {
          console.error(`Errore caricamento config ${service}:`, error);
        }
      },

      getServiceConfig: (service: ServiceType, environment?: Environment): Record<string, any> => {
        const env = environment || get().getEnvironment(service);
        const cacheKey = `${service}_${env}_config`;
        
        // Prova cache prima
        const cached = get().configCache[cacheKey];
        if (cached && get()._isCacheValid(cacheKey)) {
          return cached;
        }

        return get().configurations[service] || {};
      },

      refreshConfigurations: async (): Promise<void> => {
        const services = Object.values(ServiceType);
        const loadPromises = services.map(service => get().loadServiceConfig(service));
        await Promise.all(loadPromises);
      },

      // === Validation ===
      validateService: async (service: ServiceType, environment?: Environment): Promise<EnvironmentValidation> => {
        try {
          const { environmentApi } = await import("../services/api/environment.service");
          const response = await environmentApi.validateServiceConfiguration(service, environment);

          const validation = response.data?.validation || {
            valid: false,
            errors: [response.message || 'Errore validazione'],
            warnings: [],
            checks: {}
          };

          set(state => ({
            validations: {
              ...state.validations,
              [service]: validation
            }
          }));

          return validation;
        } catch (error: any) {
          const errorValidation = {
            valid: false,
            errors: [error.message || 'Errore validazione'],
            warnings: [],
            checks: {}
          };

          set(state => ({
            validations: {
              ...state.validations,
              [service]: errorValidation
            }
          }));

          return errorValidation;
        }
      },

      validateAllServices: async (): Promise<Record<ServiceType, EnvironmentValidation>> => {
        const services = Object.values(ServiceType);
        const validationPromises = services.map(async service => [
          service,
          await get().validateService(service)
        ] as const);

        const results = await Promise.all(validationPromises);
        return Object.fromEntries(results) as Record<ServiceType, EnvironmentValidation>;
      },

      // === Testing ===
      testConnection: async (service: ServiceType, environment?: Environment): Promise<ConnectionTestResult> => {
        try {
          const { environmentApi } = await import("../services/api/environment.service");
          const response = await environmentApi.testServiceConnection(service, environment);

          const testResult = response.data?.test_result || {
            success: false,
            environment: environment || get().getEnvironment(service),
            message: response.message || 'Test fallito',
            error: response.error
          };

          set(state => ({
            connectionTests: {
              ...state.connectionTests,
              [service]: testResult
            }
          }));

          return testResult;
        } catch (error: any) {
          const errorResult: ConnectionTestResult = {
            success: false,
            environment: environment || get().getEnvironment(service),
            message: 'Errore test connessione',
            error: error.message
          };

          set(state => ({
            connectionTests: {
              ...state.connectionTests,
              [service]: errorResult
            }
          }));

          return errorResult;
        }
      },

      testAllConnections: async (): Promise<Record<ServiceType, ConnectionTestResult>> => {
        const services = Object.values(ServiceType);
        const testPromises = services.map(async service => [
          service,
          await get().testConnection(service)
        ] as const);

        const results = await Promise.all(testPromises);
        return Object.fromEntries(results) as Record<ServiceType, ConnectionTestResult>;
      },

      // === Cache Management ===
      clearCache: (): void => {
        set({
          configCache: {},
          cacheTimestamps: {},
          connectionTests: {
            [ServiceType.DATABASE]: null,
            [ServiceType.RICETTA]: null,
            [ServiceType.SMS]: null,
            [ServiceType.RENTRI]: null
          }
        });
      },

      invalidateServiceCache: (service: ServiceType): void => {
        const state = get();
        const newCache = { ...state.configCache };
        const newTimestamps = { ...state.cacheTimestamps };

        // Rimuovi tutte le cache relative al servizio
        Object.keys(newCache).forEach(key => {
          if (key.startsWith(`${service}_`)) {
            delete newCache[key];
            delete newTimestamps[key];
          }
        });

        set({
          configCache: newCache,
          cacheTimestamps: newTimestamps,
          connectionTests: {
            ...state.connectionTests,
            [service]: null
          }
        });
      },

      // === Status ===
      getServiceStatus: async (service: ServiceType): Promise<ServiceStatus> => {
        try {
          const { environmentApi } = await import("../services/api/environment.service");
          const response = await environmentApi.getServiceEnvironment(service);

          if (response.success && response.data) {
            const status: ServiceStatus = {
              service,
              current_environment: response.data.current_environment as Environment,
              available_environments: response.data.available_environments as Environment[],
              configuration: response.data.configuration,
              validation: response.data.validation
            };

            // Aggiorna state locale
            set(state => ({
              environments: {
                ...state.environments,
                [service]: status.current_environment
              },
              configurations: {
                ...state.configurations,
                [service]: status.configuration
              },
              validations: {
                ...state.validations,
                [service]: status.validation
              }
            }));

            return status;
          } else {
            throw new Error(response.message || 'Errore recupero stato servizio');
          }
        } catch (error: any) {
          throw new Error(`Errore stato ${service}: ${error.message}`);
        }
      },

      getAllServicesStatus: async (): Promise<Record<ServiceType, ServiceStatus>> => {
        try {
          const { environmentApi } = await import("../services/api/environment.service");
          const response = await environmentApi.getEnvironmentStatus();

          if (response.success && response.data) {
            const statuses: Record<ServiceType, ServiceStatus> = {} as Record<ServiceType, ServiceStatus>;

            Object.entries(response.data.services).forEach(([serviceStr, serviceData]: [string, any]) => {
              const service = serviceStr as ServiceType;
              statuses[service] = {
                service,
                current_environment: serviceData.current_environment as Environment,
                available_environments: serviceData.available_environments as Environment[],
                configuration: serviceData.configuration,
                validation: serviceData.validation
              };
            });

            // Aggiorna state locale
            const newEnvironments: Record<ServiceType, Environment> = {} as Record<ServiceType, Environment>;
            const newConfigurations: Record<ServiceType, Record<string, any>> = {} as Record<ServiceType, Record<string, any>>;
            const newValidations: Record<ServiceType, EnvironmentValidation> = {} as Record<ServiceType, EnvironmentValidation>;

            Object.entries(statuses).forEach(([service, status]) => {
              const serviceType = service as ServiceType;
              newEnvironments[serviceType] = status.current_environment;
              newConfigurations[serviceType] = status.configuration;
              newValidations[serviceType] = status.validation;
            });

            set({
              environments: newEnvironments,
              configurations: newConfigurations,
              validations: newValidations
            });

            return statuses;
          } else {
            throw new Error(response.message || 'Errore recupero stati servizi');
          }
        } catch (error: any) {
          throw new Error(`Errore stati servizi: ${error.message}`);
        }
      },

      // === Utilities ===
      isServiceConfigured: (service: ServiceType): boolean => {
        const validation = get().validations[service];
        return validation.valid;
      },

      isServiceValid: (service: ServiceType): boolean => {
        const validation = get().validations[service];
        return validation.valid && validation.errors.length === 0;
      },

      reload: async (): Promise<void> => {
        try {
          set({ isLoading: true, error: null });
          
          get().clearCache();
          await get().getAllServicesStatus();
          await get().validateAllServices();
          
          set({ isLoading: false });
        } catch (error: any) {
          set({ 
            error: error.message || 'Errore ricaricamento',
            isLoading: false 
          });
        }
      },

      // === Helper Methods ===
      _isCacheValid: (cacheKey: string): boolean => {
        const timestamp = get().cacheTimestamps[cacheKey];
        if (!timestamp) return false;
        return Date.now() - timestamp < CACHE_DURATION;
      },

      _setCache: (cacheKey: string, value: any): void => {
        set(state => ({
          configCache: {
            ...state.configCache,
            [cacheKey]: value
          },
          cacheTimestamps: {
            ...state.cacheTimestamps,
            [cacheKey]: Date.now()
          }
        }));
      }
    }),
    {
      name: "environment-store",
      partialize: (state) => ({
        environments: state.environments,
        configurations: state.configurations,
        lastUpdated: state.lastUpdated
      })
    }
  )
);

// === Hooks specializzati ===

export const useEnvironmentSwitch = (service: ServiceType) => {
  const store = useEnvironmentStore();
  
  return {
    currentEnvironment: store.getEnvironment(service),
    availableEnvironments: [Environment.DEV, Environment.TEST, Environment.PROD].filter(env => {
      // Filtra ambienti disponibili in base al servizio
      if (service === ServiceType.RICETTA || service === ServiceType.SMS) {
        return env !== Environment.DEV;
      }
      if (service === ServiceType.DATABASE || service === ServiceType.RENTRI) {
        return env !== Environment.TEST;
      }
      return true;
    }),
    isLoading: store.isLoading,
    isValid: store.isServiceValid(service),
    switch: (environment: Environment) => store.setEnvironment(service, environment),
    test: () => store.testConnection(service),
    validate: () => store.validateService(service),
    config: store.getServiceConfig(service),
    status: null // Will be populated by getServiceStatus if needed
  };
};

export const useEnvironmentValidation = () => {
  const store = useEnvironmentStore();
  
  return {
    validation: null,
    isValidating: store.isLoading,
    validate: store.validateService,
    isValid: (service: ServiceType) => store.isServiceValid(service),
    errors: (service: ServiceType) => store.validations[service]?.errors || [],
    warnings: (service: ServiceType) => store.validations[service]?.warnings || []
  };
};

export const useEnvironmentTest = () => {
  const store = useEnvironmentStore();
  
  return {
    testResult: null,
    isTesting: store.isLoading,
    test: store.testConnection,
    isConnected: (service: ServiceType) => store.connectionTests[service]?.success || false,
    lastTested: (service: ServiceType) => store.lastUpdated[service] || null
  };
};

export const useEnvironmentBulk = () => {
  const store = useEnvironmentStore();
  
  return {
    bulkSwitch: store.bulkSetEnvironments,
    bulkTest: store.testAllConnections,
    bulkValidate: store.validateAllServices,
    isProcessing: store.isLoading,
    results: null
  };
};

export const useEnvironmentStatus = () => {
  const store = useEnvironmentStore();
  
  return {
    environments: store.environments,
    configurations: store.configurations,
    validations: store.validations,
    connectionTests: store.connectionTests,
    isLoading: store.isLoading,
    error: store.error,
    getStatus: store.getServiceStatus,
    getAllStatus: store.getAllServicesStatus,
    reload: store.reload
  };
};