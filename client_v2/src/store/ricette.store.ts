import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "@/services/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

export interface RicettaPaziente {
  id: number;
  nre: string;
  codice_pin: string;
  protocollo_transazione?: string;
  stato: 'inviata' | 'annullata' | 'erogata';
  paziente_nome: string;
  paziente_cognome: string;
  cf_assistito: string;
  data_compilazione: string;
  denominazione_farmaco: string;
  posologia: string;
  durata_trattamento: string;
  note?: string;
  pdf_base64?: string;
  created_at: string;
}

export interface StatistichePaziente {
  totale_ricette: number;
  ricette_inviate: number;
  ricette_annullate: number;
  ultima_ricetta?: string;
}

interface RicetteState {
  // Dati
  ricette: RicettaPaziente[];
  ricetteMap: Record<number, RicettaPaziente>;
  statistiche: StatistichePaziente | null;
  
  // Filtri
  filteredRicette: RicettaPaziente[];
  searchTerm: string;
  
  // Stati
  isLoading: boolean;
  error: string | null;
  
  // Cache
  lastUpdated: number | null;
  
  // Azioni
  loadRicettePaziente: (cfPaziente: string) => Promise<{ ricette: RicettaPaziente[]; statistiche: StatistichePaziente }>;
  downloadRicettaPDF: (nre: string) => Promise<Blob>;
  searchRicette: (term: string) => void;
  clearSearch: () => void;
  
  // Utilità
  invalidateCache: () => void;
}

export const useRicetteStore = create<RicetteState>()(
  persist(
    (set, get) => ({
      // Stato iniziale
      ricette: [],
      ricetteMap: {},
      statistiche: null,
      filteredRicette: [],
      searchTerm: "",
      isLoading: false,
      error: null,
      lastUpdated: null,
      
      // Carica ricette per paziente dal database locale
      loadRicettePaziente: async (cfPaziente: string) => {
        const { isLoading } = get();
        
        if (isLoading) throw new Error("Caricamento già in corso");
        
        set({ isLoading: true, error: null });
        
        let attempts = 0;
        while (attempts < MAX_RETRIES) {
          try {
            const response = await apiClient.get(`/ricetta/db/paziente/${cfPaziente}`);
            
            if (!response.data.success) {
              throw new Error(response.data.error || 'Errore nel caricamento delle ricette');
            }
            
            const ricette = response.data.data || [];
            
            // Calcola statistiche dalle ricette
            const statistiche: StatistichePaziente = {
              totale_ricette: ricette.length,
              ricette_inviate: ricette.filter((r: RicettaPaziente) => r.stato === 'inviata').length,
              ricette_annullate: ricette.filter((r: RicettaPaziente) => r.stato === 'annullata').length,
              ultima_ricetta: ricette.length > 0 ? ricette[0]?.data_compilazione : undefined
            };
            
            const ricetteMap = ricette.reduce((map: Record<number, RicettaPaziente>, ricetta: RicettaPaziente) => {
              map[ricetta.id] = ricetta;
              return map;
            }, {});
            
            set({
              ricette,
              ricetteMap,
              statistiche,
              filteredRicette: ricette,
              lastUpdated: Date.now(),
              isLoading: false,
              error: null
            });
            
            return { ricette, statistiche };
          } catch (error: any) {
            attempts++;
            if (attempts >= MAX_RETRIES) {
              const errorMessage = error.response?.data?.error || error.message || 'Errore durante il caricamento delle ricette';
              set({ 
                isLoading: false, 
                error: errorMessage,
                ricette: [],
                ricetteMap: {},
                statistiche: null
              });
              throw new Error(errorMessage);
            }
          }
        }
        
        throw new Error('Errore durante il caricamento delle ricette');
      },
      
      // Download PDF ricetta
      downloadRicettaPDF: async (nre: string) => {
        try {
          const response = await apiClient.get(`/ricetta/db/download/${nre}`, {
            responseType: 'blob'
          });
          return response.data;
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || error.message || 'Errore download PDF';
          throw new Error(errorMessage);
        }
      },
      
      // Ricerca ricette
      searchRicette: (term: string) => {
        const { ricette } = get();
        const lowerTerm = term.toLowerCase();
        
        const filteredRicette = ricette.filter(ricetta =>
          ricetta.nre.toLowerCase().includes(lowerTerm) ||
          ricetta.paziente_nome.toLowerCase().includes(lowerTerm) ||
          ricetta.paziente_cognome.toLowerCase().includes(lowerTerm) ||
          ricetta.denominazione_farmaco.toLowerCase().includes(lowerTerm) ||
          ricetta.cf_assistito.toLowerCase().includes(lowerTerm) ||
          ricetta.stato.toLowerCase().includes(lowerTerm)
        );
        
        set({ searchTerm: term, filteredRicette });
      },
      
      // Reset ricerca
      clearSearch: () => {
        const { ricette } = get();
        set({ searchTerm: "", filteredRicette: ricette });
      },
      
      // Invalida cache
      invalidateCache: () => {
        set({ lastUpdated: null });
      }
    }),
    {
      name: "ricette-storage",
      partialize: (state) => ({
        ricette: state.ricette,
        ricetteMap: state.ricetteMap,
        statistiche: state.statistiche,
        lastUpdated: state.lastUpdated
      }),
    }
  )
);

// Hook di convenienza
export const useRicette = () => {
  const store = useRicetteStore();
  
  return {
    // Dati
    ricette: store.ricette,
    statistiche: store.statistiche,
    filteredRicette: store.filteredRicette,
    
    // Stati
    isLoading: store.isLoading,
    error: store.error,
    
    // Azioni
    loadRicettePaziente: store.loadRicettePaziente,
    downloadRicettaPDF: store.downloadRicettaPDF,
    searchRicette: store.searchRicette,
    clearSearch: store.clearSearch,
    invalidateCache: store.invalidateCache
  };
};

// Export funzioni standalone per compatibilità V1
export const getRicettePaziente = async (cfPaziente: string) => {
  return useRicetteStore.getState().loadRicettePaziente(cfPaziente);
};

export const downloadRicettaPDF = async (nre: string) => {
  return useRicetteStore.getState().downloadRicettaPDF(nre);
};