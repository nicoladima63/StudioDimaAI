import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "../services/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

interface ClassificazioneFornitore {
  contoid: number | null;
  brancaid: number | null;
  sottocontoid: number | null;
  tipo_di_costo: number | null;
  is_classificato: boolean;
  is_completo: boolean;
}

export interface Fornitore {
  id: string;
  nome: string;
  codice?: string;
  partita_iva?: string;
  telefono?: string;
  email?: string;
  indirizzo?: string;
  citta?: string;
  provincia?: string;
  cap?: string;
  codice_fiscale?: string;
  sito_web?: string;
  note?: string;
  classificazione?: ClassificazioneFornitore;
  // Campi legacy per compatibilità
  classificazione_status?: string;
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
  loadFornitori: (options?: { force?: boolean; loadAll?: boolean }) => Promise<void>;
  loadAllFornitori: () => Promise<void>;
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
      loadFornitori: async ({ force = false, loadAll = false } = {}) => {
        const state = get();
        if (!force && state.fornitori.length > 0 && Date.now() - state.lastUpdated < CACHE_DURATION) {
          return;
        }

        if (loadAll) {
          return get().loadAllFornitori();
        }

        set({ isLoading: true, error: null });
        
        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            const response = await apiClient.get("/fornitori?per_page=50");
            
            if (!response.data.success) {
              throw new Error(response.data.error || "Errore caricamento fornitori");
            }
            
            // Estrai fornitori dalla struttura v2 API response
            const fornitori = response.data.data.fornitori || [];
            
            // Crea mappa id→fornitore per lookup rapidi
            const fornitoriMap = fornitori.reduce((map: Record<string, Fornitore>, fornitore: Fornitore) => {
              map[fornitore.id] = fornitore;
              return map;
            }, {});
            
            set({
              fornitori: fornitori,
              fornitoriMap,
              filteredFornitori: fornitori,
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

      // Caricamento completo per select (tutti i fornitori)
      loadAllFornitori: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // Prima chiamata per sapere il totale
          const firstResponse = await apiClient.get("/fornitori?per_page=100&page=1");
          if (!firstResponse.data.success) {
            throw new Error(firstResponse.data.error || "Errore caricamento fornitori");
          }
          
          const total = firstResponse.data.data.pagination.total;
          const pages = firstResponse.data.data.pagination.pages;
          
          let allFornitori = [...firstResponse.data.data.fornitori];
          
          // Se ci sono più pagine, carica tutte
          if (pages > 1) {
            const promises = [];
            for (let page = 2; page <= pages; page++) {
              promises.push(apiClient.get(`/fornitori?per_page=100&page=${page}`));
            }
            
            const responses = await Promise.all(promises);
            for (const response of responses) {
              if (response.data.success) {
                allFornitori.push(...response.data.data.fornitori);
              }
            }
          }
          
          // Crea mappa id→fornitore per lookup rapidi
          const fornitoriMap = allFornitori.reduce((map: Record<string, Fornitore>, fornitore: Fornitore) => {
            map[fornitore.id] = fornitore;
            return map;
          }, {});
          
          set({
            fornitori: allFornitori,
            fornitoriMap,
            filteredFornitori: allFornitori,
            isLoading: false,
            lastUpdated: Date.now(),
            error: null
          });
          
        } catch (err: any) {
          set({
            isLoading: false,
            error: err.message || "Errore caricamento fornitori"
          });
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
    loadAll: () => store.loadAllFornitori(),
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