import React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/api/client';

export interface Conto {
  codice_conto: string;
  descrizione: string;
  tipo: string;
}

export interface Sottoconto {
  codice_sottoconto: string;
  descrizione: string;
  conto_padre: string;
}

interface ContiState {
  // State
  conti: Conto[];
  sottocontiByParent: Record<string, Sottoconto[]>;
  lastUpdate: number;
  counts: { conti: number; sottoconti: number };
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConti: () => Promise<void>;
  getSottoconti: (codiceContoPadre: string) => Promise<Sottoconto[]>;
  invalidateCache: () => void;
  checkAndUpdateCache: () => Promise<boolean>;
  getCacheInfo: () => { loaded: boolean; lastUpdate?: string; counts?: any; contiCount?: number; sottocontiGroupsCount?: number };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

export const useContiStore = create<ContiState>()(
  persist(
    (set, get) => ({
      // Initial state
      conti: [],
      sottocontiByParent: {},
      lastUpdate: 0,
      counts: { conti: 0, sottoconti: 0 },
      isLoading: false,
      error: null,

      // Controlla se il cache è valido e aggiorna se necessario
      checkAndUpdateCache: async (): Promise<boolean> => {
        const state = get();
        const now = Date.now();

        // Controlla scadenza temporale
        if (now - state.lastUpdate > CACHE_DURATION) {
          console.log('Cache conti scaduto per tempo, ricaricamento...');
          await get().loadConti();
          return true;
        }

        try {
          // Controlla count dal server
          const response = await apiClient.get('/api/classificazioni/conti-sottoconti/count');
          if (!response.data.success) return false;

          const serverCounts = response.data.data;
          const countsChanged = (
            state.counts.conti !== serverCounts.conti ||
            state.counts.sottoconti !== serverCounts.sottoconti
          );

          if (countsChanged) {
            console.log('Count conti/sottoconti cambiati, ricaricamento...', {
              old: state.counts,
              new: serverCounts
            });
            await get().loadConti();
            return true;
          }

          return false; // Cache valido
        } catch (error) {
          console.warn('Errore controllo count conti:', error);
          return false;
        }
      },

      // Carica tutti i conti dal server
      loadConti: async () => {
        set({ isLoading: true, error: null });

        try {
          // Carica conti
          const contiResponse = await apiClient.get('/api/classificazioni/conti');
          if (!contiResponse.data.success) {
            throw new Error('Errore nel caricamento conti');
          }

          const conti: Conto[] = contiResponse.data.data;
          const sottocontiByParent: Record<string, Sottoconto[]> = {};

          // Carica sottoconti per ogni conto (in parallelo per performance)
          const sottocontiPromises = conti.map(async (conto) => {
            try {
              const sottocontiResponse = await apiClient.get(
                `/api/classificazioni/conti/${conto.codice_conto}/sottoconti`
              );
              
              if (sottocontiResponse.data.success && sottocontiResponse.data.data.length > 0) {
                return {
                  contoPadre: conto.codice_conto,
                  sottoconti: sottocontiResponse.data.data as Sottoconto[]
                };
              }
              return null;
            } catch (error) {
              console.warn(`Errore nel caricamento sottoconti per ${conto.codice_conto}:`, error);
              return null;
            }
          });

          const sottocontiResults = await Promise.all(sottocontiPromises);
          
          // Costruisci mappa sottoconti
          sottocontiResults.forEach(result => {
            if (result) {
              sottocontiByParent[result.contoPadre] = result.sottoconti;
            }
          });

          // Ottieni count aggiornati
          const countResponse = await apiClient.get('/api/classificazioni/conti-sottoconti/count');
          const counts = countResponse.data.success ? countResponse.data.data : { conti: 0, sottoconti: 0 };

          set({
            conti,
            sottocontiByParent,
            lastUpdate: Date.now(),
            counts,
            isLoading: false,
            error: null
          });

          console.log(`Conti caricati: ${conti.length} conti, ${Object.keys(sottocontiByParent).length} con sottoconti`);

        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Errore nel caricamento conti'
          });
          throw error;
        }
      },

      // Ottieni sottoconti per un conto (con lazy loading se necessario)
      getSottoconti: async (codiceContoPadre: string): Promise<Sottoconto[]> => {
        const state = get();

        // Controlla e aggiorna cache se necessario
        await get().checkAndUpdateCache();

        // Restituisci sottoconti dal cache
        const currentState = get();
        return currentState.sottocontiByParent[codiceContoPadre] || [];
      },

      // Invalida cache
      invalidateCache: () => {
        set({
          conti: [],
          sottocontiByParent: {},
          lastUpdate: 0,
          counts: { conti: 0, sottoconti: 0 },
          error: null
        });
      },

      // Ottieni info sul cache per debug
      getCacheInfo: () => {
        const state = get();
        if (!state.lastUpdate) {
          return { loaded: false };
        }

        return {
          loaded: true,
          lastUpdate: new Date(state.lastUpdate).toLocaleString(),
          counts: state.counts,
          contiCount: state.conti.length,
          sottocontiGroupsCount: Object.keys(state.sottocontiByParent).length
        };
      }
    }),
    {
      name: 'conti-storage', // Nome per localStorage
      partialize: (state) => ({
        // Salva solo questi campi nel localStorage
        conti: state.conti,
        sottocontiByParent: state.sottocontiByParent,
        lastUpdate: state.lastUpdate,
        counts: state.counts
      })
    }
  )
);

// Hook personalizzati per uso semplificato
export const useConti = () => {
  const { conti, isLoading, error, loadConti, checkAndUpdateCache } = useContiStore();
  
  // Auto-carica al primo uso
  React.useEffect(() => {
    if (conti.length === 0 && !isLoading) {
      checkAndUpdateCache();
    }
  }, []);

  return { conti, isLoading, error, refresh: loadConti };
};

export const useSottoconti = (codiceContoPadre: string | null) => {
  const { getSottoconti, sottocontiByParent, isLoading } = useContiStore();
  const [sottoconti, setSottoconti] = React.useState<Sottoconto[]>([]);
  const [loadingSottoconti, setLoadingSottoconti] = React.useState(false);

  React.useEffect(() => {
    if (!codiceContoPadre) {
      setSottoconti([]);
      return;
    }

    const loadSottoconti = async () => {
      setLoadingSottoconti(true);
      try {
        const result = await getSottoconti(codiceContoPadre);
        setSottoconti(result);
      } catch (error) {
        console.error('Errore caricamento sottoconti:', error);
        setSottoconti([]);
      } finally {
        setLoadingSottoconti(false);
      }
    };

    loadSottoconti();
  }, [codiceContoPadre, getSottoconti]);

  return { sottoconti, isLoading: loadingSottoconti };
};