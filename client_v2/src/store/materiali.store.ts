import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "../services/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

export interface MaterialeIntelligente {
  codice_articolo: string;
  descrizione: string;
  prezzo_unitario: number;
  quantita: number;
  totale_riga: number;
  riga_originale_id: string;
  // Dati fattura per storico prezzi
  data_fattura?: string;
  fattura_id?: string;
  riga_fattura_id?: string;
  classificazione_suggerita: {
    contoid: number | null;
    brancaid: number | null;
    sottocontoid: number | null;
    confidence: number;
    motivo: string;
  };
}

interface MaterialiFilters {
  fornitoreId?: string;
  contoid?: number;
  brancaid?: number;
  sottocontoid?: number;
  show_classified?: boolean;
}

interface MaterialiState {
  // Dati
  materialiByFornitore: Record<string, MaterialeIntelligente[]>;
  
  // Filtri e ricerca
  searchTerm: string;
  filteredMateriali: MaterialeIntelligente[];
  activeFilters: MaterialiFilters;
  
  // Stati
  isLoading: boolean;
  error: string | null;
  
  // Cache
  lastUpdated: Record<string, number>;
  
  // Azioni
  loadMaterialiByFornitore: (fornitoreId: string, options?: { force?: boolean; show_classified?: boolean }) => Promise<void>;
  searchMateriali: (term: string) => void;
  applyFilters: (filters: MaterialiFilters) => void;
  
  // Utilità
  invalidateCache: () => void;
  getMaterialiByFornitore: (fornitoreId: string) => MaterialeIntelligente[];
}

export const useMaterialiStore = create<MaterialiState>()(
  persist(
    (set, get) => ({
      materialiByFornitore: {},
      searchTerm: "",
      filteredMateriali: [],
      activeFilters: {},
      isLoading: false,
      error: null,
      lastUpdated: {},

      // Caricamento materiali per fornitore
      loadMaterialiByFornitore: async (fornitoreId: string, { force = false, show_classified = false } = {}) => {
        const state = get();
        const cacheKey = `${fornitoreId}_${show_classified}`;
        
        if (!force && 
            state.materialiByFornitore[cacheKey] && 
            Date.now() - (state.lastUpdated[cacheKey] || 0) < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, error: null });
        
        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            let url = `/api/materiali/fornitori/${fornitoreId}/materiali-intelligenti`;
            if (show_classified) {
              url += '?show_classified=true';
            }
            
            const response = await apiClient.get(url);
            if (!response.data.success) {
              throw new Error(response.data.error || "Errore caricamento materiali");
            }
            
            set({
              materialiByFornitore: { 
                ...state.materialiByFornitore, 
                [cacheKey]: response.data.data 
              },
              filteredMateriali: response.data.data,
              isLoading: false,
              lastUpdated: { 
                ...state.lastUpdated, 
                [cacheKey]: Date.now() 
              },
              error: null
            });
            return;
          } catch (err: any) {
            retry++;
            if (retry >= MAX_RETRIES) {
              set({
                isLoading: false,
                error: err.message || "Errore sconosciuto"
              });
            }
          }
        }
      },

      // Ricerca materiali in tempo reale
      searchMateriali: (term: string) => {
        const state = get();
        const allMateriali = Object.values(state.materialiByFornitore).flat();
        
        const filtered = term.trim() === "" 
          ? allMateriali
          : allMateriali.filter(materiale => 
              materiale.descrizione.toLowerCase().includes(term.toLowerCase()) ||
              materiale.codice_articolo?.toLowerCase().includes(term.toLowerCase())
            );

        set({
          searchTerm: term,
          filteredMateriali: filtered
        });
      },

      // Applicazione filtri
      applyFilters: (filters: MaterialiFilters) => {
        const state = get();
        let filtered = Object.values(state.materialiByFornitore).flat();

        // Filtro per classificazione
        if (filters.contoid) {
          filtered = filtered.filter(m => 
            m.classificazione_suggerita.contoid === filters.contoid
          );
        }

        if (filters.brancaid) {
          filtered = filtered.filter(m => 
            m.classificazione_suggerita.brancaid === filters.brancaid
          );
        }

        if (filters.sottocontoid) {
          filtered = filtered.filter(m => 
            m.classificazione_suggerita.sottocontoid === filters.sottocontoid
          );
        }

        // Applica anche ricerca se presente
        if (state.searchTerm.trim() !== "") {
          filtered = filtered.filter(materiale => 
            materiale.descrizione.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            materiale.codice_articolo?.toLowerCase().includes(state.searchTerm.toLowerCase())
          );
        }

        set({
          activeFilters: filters,
          filteredMateriali: filtered
        });
      },

      getMaterialiByFornitore: (fornitoreId: string) => {
        const state = get();
        return state.materialiByFornitore[fornitoreId] || [];
      },

      invalidateCache: () => set({
        materialiByFornitore: {},
        lastUpdated: {}
      })
    }),
    {
      name: "materiali-store",
      partialize: (state) => ({
        materialiByFornitore: state.materialiByFornitore,
        lastUpdated: state.lastUpdated
      })
    }
  )
);

// Hook ottimizzato per materiali per fornitore
export const useMaterialiByFornitore = (fornitoreId: string | null, showClassified: boolean = false) => {
  const store = useMaterialiStore();
  
  return {
    materiali: fornitoreId ? store.getMaterialiByFornitore(`${fornitoreId}_${showClassified}`) : [],
    isLoading: store.isLoading,
    error: store.error,
    load: () => fornitoreId && store.loadMaterialiByFornitore(fornitoreId, { force: true, show_classified: showClassified })
  };
};

// Hook per ricerca materiali
export const useMaterialiSearch = () => {
  const store = useMaterialiStore();
  
  return {
    materiali: store.filteredMateriali,
    isLoading: store.isLoading,
    error: store.error,
    searchTerm: store.searchTerm,
    search: store.searchMateriali,
    applyFilters: store.applyFilters,
    activeFilters: store.activeFilters
  };
};