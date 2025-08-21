import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "../services/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

// Interface per materiali dalla tabella materiali di studio_dima.db
export interface Materiale {
  id: number;
  nome: string;
  codicearticolo: string | null;
  costo_unitario: number;
  fornitoreid: string;
  fornitorenome: string;
  contoid: number | null;
  contonome: string | null;
  brancaid: number | null;
  brancanome: string | null;
  sottocontoid: number | null;
  sottocontonome: string | null;
  confermato: number;
  confidence: number;
  categoria_contabile: string | null;
}

// Filtri per materiali
export interface MaterialiFiltri {
  fornitoreid?: string;
  contoid?: number;
  brancaid?: number;
  sottocontoid?: number;
  nome?: string;
  codicearticolo?: string;
}

interface MaterialiState {
  // Dati
  materiali: Materiale[];
  materialiFiltered: Materiale[];
  
  // Filtri attivi
  filtriAttivi: MaterialiFiltri;
  
  // Stati
  isLoading: boolean;
  error: string | null;
  
  // Cache
  lastUpdated: number | null;
  
  // Azioni
  loadMateriali: (force?: boolean) => Promise<void>;
  applyFiltri: (filtri: MaterialiFiltri) => void;
  clearFiltri: () => void;
  
  // Getters
  getMaterialiByFornitore: (fornitoreid: string) => Materiale[];
  getMaterialiByConto: (contoid: number) => Materiale[];
  getMaterialiByBranca: (brancaid: number) => Materiale[];
  getMaterialiBySottoconto: (sottocontoid: number) => Materiale[];
  searchMateriali: (term: string) => Materiale[];
  
  // Utilità
  invalidateCache: () => void;
}

export const useMaterialiStore = create<MaterialiState>()(
  persist(
    (set, get) => ({
      // Stato iniziale
      materiali: [],
      materialiFiltered: [],
      filtriAttivi: {},
      isLoading: false,
      error: null,
      lastUpdated: null,

      // Carica tutti i materiali dalla tabella materiali
      loadMateriali: async (force = false) => {
        const state = get();
        
        // Check cache
        if (!force && 
            state.materiali.length > 0 && 
            state.lastUpdated && 
            Date.now() - state.lastUpdated < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, error: null });
        
        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            const response = await apiClient.get('/materiali');
            
            if (!response.data.success) {
              throw new Error(response.data.error || "Errore caricamento materiali");
            }
            
            const materiali = response.data.data.materiali || [];
            
            set({
              materiali,
              materialiFiltered: materiali,
              isLoading: false,
              lastUpdated: Date.now(),
              error: null
            });
            return;
            
          } catch (err: any) {
            retry++;
            if (retry >= MAX_RETRIES) {
              set({
                isLoading: false,
                error: err.message || "Errore sconosciuto nel caricamento materiali"
              });
            }
          }
        }
      },

      // Applica filtri ai materiali
      applyFiltri: (filtri: MaterialiFiltri) => {
        const state = get();
        let filtered = [...state.materiali];
        
        // Filtro per fornitore
        if (filtri.fornitoreid) {
          filtered = filtered.filter(m => m.fornitoreid === filtri.fornitoreid);
        }
        
        // Filtro per conto
        if (filtri.contoid) {
          filtered = filtered.filter(m => m.contoid === filtri.contoid);
        }
        
        // Filtro per branca
        if (filtri.brancaid) {
          filtered = filtered.filter(m => m.brancaid === filtri.brancaid);
        }
        
        // Filtro per sottoconto
        if (filtri.sottocontoid) {
          filtered = filtered.filter(m => m.sottocontoid === filtri.sottocontoid);
        }
        
        // Filtro per nome (ricerca testuale)
        if (filtri.nome && filtri.nome.trim()) {
          const searchTerm = filtri.nome.toLowerCase().trim();
          filtered = filtered.filter(m => 
            m.nome.toLowerCase().includes(searchTerm)
          );
        }
        
        // Filtro per codice articolo (ricerca testuale)
        if (filtri.codicearticolo && filtri.codicearticolo.trim()) {
          const searchTerm = filtri.codicearticolo.toLowerCase().trim();
          filtered = filtered.filter(m => 
            m.codicearticolo?.toLowerCase().includes(searchTerm)
          );
        }
        
        set({
          filtriAttivi: filtri,
          materialiFiltered: filtered
        });
      },

      // Pulisce tutti i filtri
      clearFiltri: () => {
        const state = get();
        set({
          filtriAttivi: {},
          materialiFiltered: state.materiali
        });
      },

      // Getter per materiali di un fornitore specifico
      getMaterialiByFornitore: (fornitoreid: string) => {
        const state = get();
        return state.materiali.filter(m => m.fornitoreid === fornitoreid);
      },

      // Getter per materiali di un conto specifico
      getMaterialiByConto: (contoid: number) => {
        const state = get();
        return state.materiali.filter(m => m.contoid === contoid);
      },

      // Getter per materiali di una branca specifica
      getMaterialiByBranca: (brancaid: number) => {
        const state = get();
        return state.materiali.filter(m => m.brancaid === brancaid);
      },

      // Getter per materiali di un sottoconto specifico
      getMaterialiBySottoconto: (sottocontoid: number) => {
        const state = get();
        return state.materiali.filter(m => m.sottocontoid === sottocontoid);
      },

      // Ricerca materiali per nome o codice
      searchMateriali: (term: string) => {
        const state = get();
        if (!term.trim()) return state.materiali;
        
        const searchTerm = term.toLowerCase().trim();
        return state.materiali.filter(m => 
          m.nome.toLowerCase().includes(searchTerm) ||
          m.codicearticolo?.toLowerCase().includes(searchTerm)
        );
      },

      // Invalida cache
      invalidateCache: () => set({
        materiali: [],
        materialiFiltered: [],
        lastUpdated: null
      })
    }),
    {
      name: "materiali-store",
      partialize: (state) => ({
        materiali: state.materiali,
        lastUpdated: state.lastUpdated
      })
    }
  )
);

// Hook per materiali con caricamento automatico
export const useMateriali = () => {
  const store = useMaterialiStore();
  
  return {
    materiali: store.materialiFiltered,
    isLoading: store.isLoading,
    error: store.error,
    filtriAttivi: store.filtriAttivi,
    load: store.loadMateriali,
    applyFiltri: store.applyFiltri,
    clearFiltri: store.clearFiltri
  };
};

// Hook per materiali di un fornitore specifico
export const useMaterialiByFornitore = (fornitoreid: string | null) => {
  const store = useMaterialiStore();
  
  return {
    materiali: fornitoreid ? store.getMaterialiByFornitore(fornitoreid) : [],
    isLoading: store.isLoading,
    error: store.error,
    load: store.loadMateriali
  };
};

// Hook per materiali di un conto specifico
export const useMaterialiByConto = (contoid: number | null) => {
  const store = useMaterialiStore();
  
  return {
    materiali: contoid ? store.getMaterialiByConto(contoid) : [],
    isLoading: store.isLoading,
    error: store.error,
    load: store.loadMateriali
  };
};

// Hook per ricerca materiali
export const useMaterialiSearch = () => {
  const store = useMaterialiStore();
  
  return {
    search: store.searchMateriali,
    isLoading: store.isLoading,
    error: store.error,
    load: store.loadMateriali
  };
};