// store/classificazioniStore.ts
import React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "@/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

export interface ClassificazioneCosto {
  id: number;
  codice_riferimento: string;
  tipo_entita: 'fornitore' | 'spesa';
  tipo_di_costo: 1 | 2 | 3;
  note: string | null;
  contoid: number | null;
  brancaid: number | null;
  sottocontoid: number | null;
  data_classificazione: string;
  data_modifica: string;
  fornitore_nome?: string;
  // Campi aggregati dai JOIN
  conto_nome?: string;
  branca_nome?: string;
  sottoconto_nome?: string;
}

interface State {
  // Dati
  classificazioni: ClassificazioneCosto[];
  
  // Stati
  isLoading: boolean;
  error: string | null;
  
  // Cache
  lastUpdated: number;
  
  // Azioni
  loadClassificazioni: (options?: { force?: boolean }) => Promise<void>;
  
  // Utilità
  invalidateCache: () => void;
  getClassificazioneById: (id: number) => ClassificazioneCosto | undefined;
}

export const useClassificazioniStore = create<State>()(
  persist(
    (set, get) => ({
      classificazioni: [],
      isLoading: false,
      error: null,
      lastUpdated: 0,

      loadClassificazioni: async (options = {}) => {
        const { force = false } = options;
        const state = get();
        const now = Date.now();
        
        if (!force && state.classificazioni.length > 0 && 
            (now - state.lastUpdated) < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, error: null });
        
        let retries = 0;
        while (retries < MAX_RETRIES) {
          try {
            const response = await apiClient.get('/api/classificazioni/all');
            
            if (response.data.success) {
              set({ 
                classificazioni: response.data.data,
                lastUpdated: now,
                isLoading: false 
              });
              return;
            } else {
              throw new Error(response.data.error || 'Errore nel caricamento classificazioni');
            }
          } catch (error: any) {
            retries++;
            if (retries >= MAX_RETRIES) {
              set({ 
                error: error.message || 'Errore di connessione',
                isLoading: false 
              });
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
      },

      invalidateCache: () => {
        set({ 
          lastUpdated: 0,
          classificazioni: []
        });
      },

      getClassificazioneById: (id: number) => {
        return get().classificazioni.find(c => c.id === id);
      }
    }),
    {
      name: 'classificazioni-store',
      version: 1,
    }
  )
);

// Hook generico per filtrare classificazioni
export const useClassificazioni = (filtro?: string) => {
  const { classificazioni, loadClassificazioni, isLoading, error } = useClassificazioniStore();
  
  React.useEffect(() => {
    loadClassificazioni();
  }, [loadClassificazioni]);

  const classificazioniFiltrate = React.useMemo(() => {
    if (!filtro) return classificazioni;
    
    const filtroUpper = filtro.toUpperCase();
    return classificazioni.filter(c => 
      c.conto_nome?.toUpperCase().includes(filtroUpper) ||
      c.branca_nome?.toUpperCase().includes(filtroUpper) ||
      c.sottoconto_nome?.toUpperCase().includes(filtroUpper)
    );
  }, [classificazioni, filtro]);

  return {
    classificazioni: classificazioniFiltrate,
    isLoading,
    error
  };
};