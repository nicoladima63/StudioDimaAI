import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RicettaStoreState,
  RicettaActions,
  RicettaFormData,
  RicettaFormErrors,
  RicettaEnvironment,
  RicettaPayload,
  RicettaResponse,
  Diagnosi,
  Farmaco,
  ProtocolloTerapeutico,
  ConnectionTestResult,
  EnvironmentConfig,
  RICETTA_FORM_DEFAULTS
} from "../types/ricetta.types";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const SEARCH_DEBOUNCE = 300; // 300ms debounce per ricerche

// Form defaults
const FORM_DEFAULTS: RicettaFormData = {
  paziente_id: null,
  paziente: null,
  diagnosi: null,
  farmaco: null,
  posologia: '',
  durata: '',
  quantita: 1,
  note: '',
  tipo_ricetta: 'R'
};

interface RicettaStore extends RicettaStoreState, RicettaActions {}

export const useRicettaStore = create<RicettaStore>()(
  persist(
    (set, get) => ({
      // === State iniziale ===
      environment: 'test',
      environmentConfig: null,
      
      form: {
        data: FORM_DEFAULTS,
        errors: {},
        isValid: false,
        isSubmitting: false,
        isDirty: false
      },
      
      diagnosi: [],
      farmaci: [],
      protocolli: [],
      pazienti: [],
      
      diagnosiSearch: {
        query: '',
        results: [],
        loading: false
      },
      farmaciSearch: {
        query: '',
        results: [],
        loading: false
      },
      
      posologie: [],
      durate: [],
      note: [],
      
      isLoading: false,
      error: null,
      lastTest: null,
      
      lastUpdated: {
        diagnosi: 0,
        farmaci: 0,
        protocolli: 0,
        posologie: 0,
        durate: 0,
        note: 0
      },

      // === Environment ===
      setEnvironment: (env: RicettaEnvironment) => {
        set({ environment: env, environmentConfig: null });
        get().loadEnvironmentConfig();
      },

      loadEnvironmentConfig: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const { ricettaApi } = await import("../services/api/ricetta.service");
          const response = await ricettaApi.getEnvironmentInfo();
          
          if (response.success) {
            set({
              environmentConfig: response.data,
              isLoading: false
            });
          } else {
            throw new Error(response.message || 'Errore caricamento configurazione');
          }
        } catch (error: any) {
          set({
            error: error.message || 'Errore caricamento ambiente',
            isLoading: false
          });
        }
      },

      testConnection: async (): Promise<ConnectionTestResult> => {
        try {
          set({ isLoading: true, error: null });
          
          const { ricettaApi } = await import("../services/api/ricetta.service");
          const response = await ricettaApi.testConnection();
          
          const result: ConnectionTestResult = {
            success: response.success,
            environment: get().environment,
            endpoint: response.data?.endpoint || '',
            status_code: response.data?.status_code,
            certificates: response.data?.certificates,
            ssl_version: response.data?.ssl_version,
            message: response.message || '',
            error: response.error
          };
          
          set({
            lastTest: result,
            isLoading: false
          });
          
          return result;
          
        } catch (error: any) {
          const result: ConnectionTestResult = {
            success: false,
            environment: get().environment,
            endpoint: '',
            message: 'Errore test connessione',
            error: error.message
          };
          
          set({
            lastTest: result,
            error: error.message,
            isLoading: false
          });
          
          return result;
        }
      },

      // === Form management ===
      updateFormData: (data: Partial<RicettaFormData>) => {
        const currentForm = get().form;
        const newData = { ...currentForm.data, ...data };
        
        set({
          form: {
            ...currentForm,
            data: newData,
            isDirty: true,
            isValid: get().validateForm()
          }
        });
      },

      setFormErrors: (errors: Partial<RicettaFormErrors>) => {
        const currentForm = get().form;
        
        set({
          form: {
            ...currentForm,
            errors: { ...currentForm.errors, ...errors }
          }
        });
      },

      resetForm: () => {
        set({
          form: {
            data: FORM_DEFAULTS,
            errors: {},
            isValid: false,
            isSubmitting: false,
            isDirty: false
          }
        });
      },

      validateForm: (): boolean => {
        const { data } = get().form;
        const errors: RicettaFormErrors = {};
        
        // Validazioni
        if (!data.paziente) {
          errors.paziente = 'Paziente obbligatorio';
        }
        
        if (!data.diagnosi) {
          errors.diagnosi = 'Diagnosi obbligatoria';
        }
        
        if (!data.farmaco) {
          errors.farmaco = 'Farmaco obbligatorio';
        }
        
        if (!data.posologia?.trim()) {
          errors.posologia = 'Posologia obbligatoria';
        }
        
        if (!data.durata?.trim()) {
          errors.durata = 'Durata terapia obbligatoria';
        }
        
        if (data.quantita < 1) {
          errors.quantita = 'Quantità deve essere maggiore di 0';
        }
        
        // Aggiorna errori
        get().setFormErrors(errors);
        
        return Object.keys(errors).length === 0;
      },

      // === Search ===
      searchDiagnosi: async (query: string): Promise<Diagnosi[]> => {
        if (!query || query.length < 2) {
          set({
            diagnosiSearch: {
              query: '',
              results: [],
              loading: false
            }
          });
          return [];
        }

        set({
          diagnosiSearch: {
            query,
            results: [],
            loading: true
          }
        });

        try {
          const { ricettaApi } = await import("../services/api/ricetta.service");
          const response = await ricettaApi.searchDiagnosi(query);
          
          if (response.success) {
            const results = response.data || [];
            set({
              diagnosiSearch: {
                query,
                results,
                loading: false
              }
            });
            return results;
          } else {
            throw new Error(response.message || 'Errore ricerca diagnosi');
          }
        } catch (error: any) {
          set({
            diagnosiSearch: {
              query,
              results: [],
              loading: false
            },
            error: error.message
          });
          return [];
        }
      },

      searchFarmaci: async (query: string): Promise<Farmaco[]> => {
        if (!query || query.length < 2) {
          set({
            farmaciSearch: {
              query: '',
              results: [],
              loading: false
            }
          });
          return [];
        }

        set({
          farmaciSearch: {
            query,
            results: [],
            loading: true
          }
        });

        try {
          const { ricettaApi } = await import("../services/api/ricetta.service");
          const response = await ricettaApi.searchFarmaci(query);
          
          if (response.success) {
            const results = response.data || [];
            set({
              farmaciSearch: {
                query,
                results,
                loading: false
              }
            });
            return results;
          } else {
            throw new Error(response.message || 'Errore ricerca farmaci');
          }
        } catch (error: any) {
          set({
            farmaciSearch: {
              query,
              results: [],
              loading: false
            },
            error: error.message
          });
          return [];
        }
      },

      getFarmaciPerDiagnosi: async (codiceDiagnosi: string): Promise<Farmaco[]> => {
        try {
          const { ricettaApi } = await import("../services/api/ricetta.service");
          const response = await ricettaApi.getFarmaciPerDiagnosi(codiceDiagnosi);
          
          if (response.success) {
            return response.data || [];
          } else {
            throw new Error(response.message || 'Errore caricamento farmaci per diagnosi');
          }
        } catch (error: any) {
          set({ error: error.message });
          return [];
        }
      },

      // === Protocolli ===
      loadProtocolli: async () => {
        const state = get();
        const now = Date.now();
        
        // Cache check
        if (state.protocolli.length > 0 && 
            now - state.lastUpdated.protocolli < CACHE_DURATION) {
          return;
        }

        try {
          set({ isLoading: true });
          
          const { ricettaApi } = await import("../services/api/ricetta.service");
          const response = await ricettaApi.getProtocolli();
          
          if (response.success) {
            set({
              protocolli: response.data || [],
              lastUpdated: {
                ...state.lastUpdated,
                protocolli: now
              },
              isLoading: false
            });
          } else {
            throw new Error(response.message || 'Errore caricamento protocolli');
          }
        } catch (error: any) {
          set({
            error: error.message,
            isLoading: false
          });
        }
      },

      getProtocolloById: (id: string): ProtocolloTerapeutico | null => {
        return get().protocolli.find(p => p.id === id) || null;
      },

      applyProtocollo: (protocollo: ProtocolloTerapeutico) => {
        const formData: Partial<RicettaFormData> = {
          diagnosi: protocollo.diagnosi,
          farmaco: protocollo.farmaci[0] || null, // Prende il primo farmaco
          posologia: protocollo.posologia_standard || '',
          durata: protocollo.durata_standard || '',
          note: protocollo.note || '',
          protocollo_id: protocollo.id
        };

        get().updateFormData(formData);
      },

      // === Suggerimenti ===
      loadSuggerimenti: async () => {
        const state = get();
        const now = Date.now();
        
        try {
          const { ricettaApi } = await import("../services/api/ricetta.service");
          
          // Carica posologie se necessario
          if (state.posologie.length === 0 || 
              now - state.lastUpdated.posologie > CACHE_DURATION) {
            const posologieResp = await ricettaApi.getPosologieSuggestions();
            if (posologieResp.success) {
              set(state => ({
                posologie: posologieResp.data || [],
                lastUpdated: {
                  ...state.lastUpdated,
                  posologie: now
                }
              }));
            }
          }
          
          // Carica durate se necessario
          if (state.durate.length === 0 || 
              now - state.lastUpdated.durate > CACHE_DURATION) {
            const durateResp = await ricettaApi.getDurateSuggestions();
            if (durateResp.success) {
              set(state => ({
                durate: durateResp.data || [],
                lastUpdated: {
                  ...state.lastUpdated,
                  durate: now
                }
              }));
            }
          }
          
          // Carica note se necessario
          if (state.note.length === 0 || 
              now - state.lastUpdated.note > CACHE_DURATION) {
            const noteResp = await ricettaApi.getNoteSuggestions();
            if (noteResp.success) {
              set(state => ({
                note: noteResp.data || [],
                lastUpdated: {
                  ...state.lastUpdated,
                  note: now
                }
              }));
            }
          }
          
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      getSuggerimentiPosologie: () => get().posologie,
      getSuggerimentiDurate: () => get().durate,
      getSuggerimentiNote: () => get().note,

      // === Invio ricetta ===
      inviaRicetta: async (payload: RicettaPayload): Promise<RicettaResponse> => {
        set({
          form: { ...get().form, isSubmitting: true },
          error: null
        });

        try {
          const { ricettaApi } = await import("../services/api/ricetta.service");
          const response = await ricettaApi.inviaRicetta(payload);
          
          set({
            form: { ...get().form, isSubmitting: false }
          });
          
          return response;
          
        } catch (error: any) {
          set({
            form: { ...get().form, isSubmitting: false },
            error: error.message
          });
          
          return {
            success: false,
            error: error.message,
            message: 'Errore durante l\'invio della ricetta'
          };
        }
      },

      // === Utilities ===
      clearCache: () => {
        set({
          diagnosi: [],
          farmaci: [],
          protocolli: [],
          posologie: [],
          durate: [],
          note: [],
          diagnosiSearch: { query: '', results: [], loading: false },
          farmaciSearch: { query: '', results: [], loading: false },
          lastUpdated: {
            diagnosi: 0,
            farmaci: 0,
            protocolli: 0,
            posologie: 0,
            durate: 0,
            note: 0
          }
        });
      },

      reload: async () => {
        get().clearCache();
        await Promise.all([
          get().loadEnvironmentConfig(),
          get().loadProtocolli(),
          get().loadSuggerimenti()
        ]);
      }
    }),
    {
      name: "ricetta-store",
      partialize: (state) => ({
        environment: state.environment,
        protocolli: state.protocolli,
        posologie: state.posologie,
        durate: state.durate,
        note: state.note,
        lastUpdated: state.lastUpdated
      })
    }
  )
);

// === Hooks specializzati ===
export const useRicettaForm = () => {
  const store = useRicettaStore();
  
  return {
    form: store.form,
    updateData: store.updateFormData,
    setErrors: store.setFormErrors,
    reset: store.resetForm,
    validate: store.validateForm,
    isSubmitting: store.form.isSubmitting
  };
};

export const useRicettaSearch = () => {
  const store = useRicettaStore();
  
  return {
    // Diagnosi
    searchDiagnosi: store.searchDiagnosi,
    diagnosiResults: store.diagnosiSearch.results,
    diagnosiLoading: store.diagnosiSearch.loading,
    diagnosiQuery: store.diagnosiSearch.query,
    
    // Farmaci
    searchFarmaci: store.searchFarmaci,
    farmaciResults: store.farmaciSearch.results,
    farmaciLoading: store.farmaciSearch.loading,
    farmaciQuery: store.farmaciSearch.query,
    
    // Utilities
    getFarmaciPerDiagnosi: store.getFarmaciPerDiagnosi,
    clearResults: () => {
      store.searchDiagnosi('');
      store.searchFarmaci('');
    }
  };
};

export const useRicettaProtocolli = () => {
  const store = useRicettaStore();
  
  return {
    protocolli: store.protocolli,
    getById: store.getProtocolloById,
    apply: store.applyProtocollo,
    load: store.loadProtocolli,
    isLoading: store.isLoading
  };
};

export const useRicettaEnvironment = () => {
  const store = useRicettaStore();
  
  return {
    environment: store.environment,
    config: store.environmentConfig,
    setEnvironment: store.setEnvironment,
    testConnection: store.testConnection,
    lastTest: store.lastTest,
    isLoading: store.isLoading
  };
};