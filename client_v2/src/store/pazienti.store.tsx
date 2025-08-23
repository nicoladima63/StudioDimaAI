import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "@/services/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

// Interfaccia Paziente completa per tutti i campi DBF
export interface Paziente {
  id: string;
  nome: string;
  codice_fiscale?: string;
  data_nascita?: string; // ISO date string
  luogo_nascita?: string;
  provincia_nascita?: string;
  sesso?: "M" | "F" | "N";
  telefono?: string;
  cellulare?: string;
  email?: string;
  indirizzo?: string;
  citta?: string;
  provincia?: string;
  cap?: string;
  note?: string;
  ultima_visita?: string; // ISO date string
  mesi_richiamo?: number;
  tipo_richiamo?: string;
  da_richiamare?: string; // 1 carattere: S=si
  non_in_cura?: boolean;
}

interface PazientiState {
  // Dati
  pazienti: Paziente[];
  pazientiMap: Record<string, Paziente>;
  
  // Filtri e ricerca
  filteredPazienti: Paziente[];
  searchTerm: string;
  
  // Stati
  isLoading: boolean;
  error: string | null;
  
  // Cache
  lastUpdated: number;
  
  // Azioni
  loadPazienti: (options?: { force?: boolean; loadAll?: boolean }) => Promise<void>;
  loadAllPazienti: () => Promise<void>;
  searchPazienti: (term: string) => void;
  getPazienteById: (id: string) => Paziente | undefined;
  
  // Utilità
  invalidateCache: () => void;
}

export const usePazientiStore = create<PazientiState>()(
  persist(
    (set, get) => ({
      pazienti: [],
      pazientiMap: {},
      filteredPazienti: [],
      searchTerm: "",
      isLoading: false,
      error: null,
      lastUpdated: 0,

      // Caricamento pazienti con retry - Pattern da FornitoriStore
      loadPazienti: async ({ force = false, loadAll = false } = {}) => {
        const state = get();
        if (!force && state.pazienti.length > 0 && Date.now() - state.lastUpdated < CACHE_DURATION) {
          return;
        }

        if (loadAll) {
          return get().loadAllPazienti();
        }

        set({ isLoading: true, error: null });
        
        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            const response = await apiClient.get("/pazienti?per_page=50");
            
            if (!response.data.success) {
              throw new Error(response.data.error || "Errore caricamento pazienti");
            }
            
            // Estrai pazienti dalla struttura v2 API response
            const pazienti = response.data.data.pazienti || [];
            
            // Crea mappa id→paziente per lookup rapidi
            const pazientiMap = pazienti.reduce((map: Record<string, Paziente>, paziente: Paziente) => {
              map[paziente.id] = paziente;
              return map;
            }, {});

            set({
              pazienti,
              pazientiMap,
              filteredPazienti: pazienti,
              isLoading: false,
              error: null,
              lastUpdated: Date.now(),
              searchTerm: ""
            });
            return;

          } catch (error: any) {
            retry++;
            if (retry >= MAX_RETRIES) {
              console.error("Failed to load pazienti after retries:", error);
              set({ 
                isLoading: false, 
                error: error.message || "Errore caricamento pazienti"
              });
              return;
            }
          }
        }
      },

      // Carica tutti i pazienti - Pattern da FornitoriStore
      loadAllPazienti: async () => {
        set({ isLoading: true, error: null });
        
        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            const response = await apiClient.get("/pazienti?all=1");
            
            if (!response.data.success) {
              throw new Error(response.data.error || "Errore caricamento pazienti");
            }
            
            const pazienti = response.data.data.pazienti || [];
            
            const pazientiMap = pazienti.reduce((map: Record<string, Paziente>, paziente: Paziente) => {
              map[paziente.id] = paziente;
              return map;
            }, {});

            set({
              pazienti,
              pazientiMap,
              filteredPazienti: pazienti,
              isLoading: false,
              error: null,
              lastUpdated: Date.now(),
              searchTerm: ""
            });
            return;

          } catch (error: any) {
            retry++;
            if (retry >= MAX_RETRIES) {
              console.error("Failed to load all pazienti after retries:", error);
              set({ 
                isLoading: false, 
                error: error.message || "Errore caricamento pazienti"
              });
              return;
            }
          }
        }
      },

      // Ricerca pazienti - Pattern da FornitoriStore
      searchPazienti: (term: string) => {
        const { pazienti } = get();
        const lowerTerm = term.toLowerCase();
        
        if (!term.trim()) {
          set({ 
            filteredPazienti: pazienti, 
            searchTerm: "" 
          });
          return;
        }

        const filteredPazienti = pazienti.filter(paziente =>
          paziente.nome.toLowerCase().includes(lowerTerm) ||
          (paziente.codice_fiscale && paziente.codice_fiscale.toLowerCase().includes(lowerTerm)) ||
          (paziente.telefono && paziente.telefono.toLowerCase().includes(lowerTerm)) ||
          (paziente.cellulare && paziente.cellulare.toLowerCase().includes(lowerTerm)) ||
          (paziente.email && paziente.email.toLowerCase().includes(lowerTerm))
        );
        
        set({ 
          filteredPazienti, 
          searchTerm: term 
        });
      },

      // Getter per ID - Pattern da FornitoriStore
      getPazienteById: (id: string) => {
        const { pazientiMap } = get();
        return pazientiMap[id];
      },

      // Invalidate cache - Pattern da FornitoriStore
      invalidateCache: () => {
        set({ lastUpdated: 0 });
      }
    }),
    {
      name: "pazienti-storage",
      partialize: (state) => ({
        pazienti: state.pazienti,
        pazientiMap: state.pazientiMap,
        lastUpdated: state.lastUpdated
      }),
    }
  )
);

// Hook conveniente per uso nei componenti - seguendo il pattern di fornitori.store
export const usePazienti = () => {
  const store = usePazientiStore();
  
  return {
    pazienti: store.filteredPazienti,
    allPazienti: store.pazienti,
    isLoading: store.isLoading,
    error: store.error,
    searchTerm: store.searchTerm,
    search: store.searchPazienti,
    load: () => store.loadPazienti({ force: true }),
    loadAll: () => store.loadAllPazienti(),
    getById: store.getPazienteById
  };
};