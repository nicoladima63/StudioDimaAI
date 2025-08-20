import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "../services/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

export interface Fornitore {
  id: string;
  nome: string;
  codice?: string;
  partita_iva?: string;
  // Altri campi secondo necessità
}

interface FornitoriState {
  // Dati
  fornitori: Fornitore[];
  fornitoriMap: Record<string, Fornitore>;
  
  // Filtri e ricerca
  filteredFornitori: Fornitore[];
  searchTerm: string;
  
  // Stati
  isLoading: boolean;
  error: string | null;
  
  // Cache
  lastUpdated: number;
  
  // Azioni
  loadFornitori: (options?: { force?: boolean }) => Promise<void>;
  searchFornitori: (term: string) => void;
  getFornitoreById: (id: string) => Fornitore | undefined;
  
  // Utilità
  invalidateCache: () => void;
}

export const useFornitoriStore = create<FornitoriState>()(
  persist(
    (set, get) => ({
      fornitori: [],
      fornitoriMap: {},
      filteredFornitori: [],
      searchTerm: "",
      isLoading: false,
      error: null,
      lastUpdated: 0,

      // Caricamento fornitori con retry
      loadFornitori: async ({ force = false } = {}) => {
        const state = get();
        if (!force && state.fornitori.length > 0 && Date.now() - state.lastUpdated < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, error: null });
        
        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            const response = await apiClient.get("/api/fornitori");
            if (!response.data.success) {
              throw new Error(response.data.error || "Errore caricamento fornitori");
            }
            
            // Crea mappa id→fornitore per lookup rapidi
            const fornitoriMap = response.data.data.reduce((map: Record<string, Fornitore>, fornitore: Fornitore) => {
              map[fornitore.id] = fornitore;
              return map;
            }, {});
            
            set({
              fornitori: response.data.data,
              fornitoriMap,
              filteredFornitori: response.data.data,
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
                error: err.message || "Errore sconosciuto"
              });
            }
          }
        }
      },

      // Ricerca fornitori in tempo reale
      searchFornitori: (term: string) => {
        const state = get();
        const filtered = term.trim() === "" 
          ? state.fornitori
          : state.fornitori.filter(fornitore => 
              fornitore.nome.toLowerCase().includes(term.toLowerCase()) ||
              fornitore.codice?.toLowerCase().includes(term.toLowerCase()) ||
              fornitore.partita_iva?.toLowerCase().includes(term.toLowerCase())
            );

        set({
          searchTerm: term,
          filteredFornitori: filtered
        });
      },

      getFornitoreById: (id: string) => get().fornitoriMap[id],

      invalidateCache: () => set({
        fornitori: [],
        fornitoriMap: {},
        filteredFornitori: [],
        lastUpdated: 0
      })
    }),
    {
      name: "fornitori-store",
      partialize: (state) => ({
        fornitori: state.fornitori,
        fornitoriMap: state.fornitoriMap,
        lastUpdated: state.lastUpdated
      })
    }
  )
);

// Hook ottimizzato con caricamento automatico
export const useFornitori = () => {
  const store = useFornitoriStore();
  
  return {
    fornitori: store.filteredFornitori,
    allFornitori: store.fornitori,
    isLoading: store.isLoading,
    error: store.error,
    searchTerm: store.searchTerm,
    search: store.searchFornitori,
    load: () => store.loadFornitori({ force: true }),
    getById: store.getFornitoreById
  };
};

// Hook per ricerca con debounce
export const useFornitoriSearch = () => {
  const store = useFornitoriStore();
  
  return {
    fornitori: store.filteredFornitori,
    isLoading: store.isLoading,
    error: store.error,
    searchTerm: store.searchTerm,
    search: store.searchFornitori,
    getById: store.getFornitoreById
  };
};