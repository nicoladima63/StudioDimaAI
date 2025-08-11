// store/contiStore.ts
import  {useEffect} from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "@/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

interface Conto { id: number; nome: string; }
interface Branca { id: number; nome: string; contoId: number; }
interface Sottoconto { id: number; nome: string; brancaId: number; contoId: number; }

interface State {
  // Dati
  conti: Conto[];
  brancheByConto: Record<number, Branca[]>;
  sottocontiByBranca: Record<number, Sottoconto[]>;
  
  // Stati
  isLoading: boolean;
  errors: Record<string, string | null>;
  
  // Cache
  lastUpdated: {
    conti: number;
    branche: Record<number, number>;
    sottoconti: Record<number, number>;
  };
  
  // Azioni
  loadConti: (options?: { force?: boolean }) => Promise<void>;
  loadBranche: (contoId: number, options?: { force?: boolean }) => Promise<void>;
  loadSottoconti: (brancaId: number, options?: { force?: boolean }) => Promise<void>;
  
  // Utilità
  invalidateCache: () => void;
  getContoById: (id: number) => Conto | undefined;
}

export const useContiStore = create<State>()(
  persist(
    (set, get) => ({
      conti: [],
      brancheByConto: {},
      sottocontiByBranca: {},
      isLoading: false,
      errors: { conti: null, branche: null, sottoconti: null },
      lastUpdated: { conti: 0, branche: {}, sottoconti: {} },

      // Caricamento conti con retry
      loadConti: async ({ force = false } = {}) => {
        const state = get();
        if (!force && state.conti.length > 0 && Date.now() - state.lastUpdated.conti < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, errors: { ...state.errors, conti: null } });
        
        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            const res = await apiClient.get("/api/struttura-conti/conti");
            if (!res.data.success) throw new Error(res.data.error || "Errore caricamento conti");
            
            set({
              conti: res.data.data,
              isLoading: false,
              lastUpdated: { ...state.lastUpdated, conti: Date.now() },
              errors: { ...state.errors, conti: null }
            });
            return;
          } catch (err: any) {
            retry++;
            if (retry >= MAX_RETRIES) {
              set({
                isLoading: false,
                errors: { ...state.errors, conti: err.message || "Errore sconosciuto" }
              });
            }
          }
        }
      },

      // Caricamento branche con cache per conto
      loadBranche: async (contoId, { force = false } = {}) => {
        const state = get();
        if (!force && 
            state.brancheByConto[contoId] && 
            Date.now() - (state.lastUpdated.branche[contoId] || 0) < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, errors: { ...state.errors, branche: null } });
        
        try {
          const res = await apiClient.get(`/api/struttura-conti/branche?conto_id=${contoId}`);
          if (!res.data.success) throw new Error("Errore caricamento branche");
          
          set({
            brancheByConto: { ...state.brancheByConto, [contoId]: res.data.data },
            isLoading: false,
            lastUpdated: { 
              ...state.lastUpdated, 
              branche: { ...state.lastUpdated.branche, [contoId]: Date.now() } 
            },
            errors: { ...state.errors, branche: null }
          });
        } catch (err: any) {
          set({
            isLoading: false,
            errors: { ...state.errors, branche: err.message || "Errore sconosciuto" }
          });
        }
      },

      // Caricamento sottoconti con cache per branca
      loadSottoconti: async (brancaId, { force = false } = {}) => {
        const state = get();
        if (!force && 
            state.sottocontiByBranca[brancaId] && 
            Date.now() - (state.lastUpdated.sottoconti[brancaId] || 0) < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, errors: { ...state.errors, sottoconti: null } });
        
        try {
          const res = await apiClient.get(`/api/struttura-conti/sottoconti?branca_id=${brancaId}`);
          if (!res.data.success) throw new Error("Errore caricamento sottoconti");
          
          set({
            sottocontiByBranca: { ...state.sottocontiByBranca, [brancaId]: res.data.data },
            isLoading: false,
            lastUpdated: { 
              ...state.lastUpdated, 
              sottoconti: { ...state.lastUpdated.sottoconti, [brancaId]: Date.now() } 
            },
            errors: { ...state.errors, sottoconti: null }
          });
        } catch (err: any) {
          set({
            isLoading: false,
            errors: { ...state.errors, sottoconti: err.message || "Errore sconosciuto" }
          });
        }
      },

      invalidateCache: () => set({
        conti: [],
        brancheByConto: {},
        sottocontiByBranca: {},
        lastUpdated: { conti: 0, branche: {}, sottoconti: {} }
      }),

      getContoById: (id) => get().conti.find(c => c.id === id)
    }),
    {
      name: "conti-store",
      partialize: (state) => ({
        conti: state.conti,
        lastUpdated: state.lastUpdated
      })
    }
  )
);

// Hook ottimizzati con caricamento automatico
export const useConti = () => {
  const store = useContiStore();
  
  useEffect(() => {
    store.loadConti();
  }, [store.loadConti]);

  return {
    conti: store.conti,
    isLoading: store.isLoading,
    error: store.errors.conti,
    load: () => store.loadConti({ force: true }),
    loadConti: () => store.loadConti({ force: true }),
    getById: store.getContoById
  };
};

export const useBranche = (contoId: number | null) => {
  const store = useContiStore();
  
  useEffect(() => {
    if (contoId) store.loadBranche(contoId);
  }, [contoId, store.loadBranche]);

  return {
    branche: contoId ? (store.brancheByConto[contoId] || []) : [],
    isLoading: store.isLoading,
    error: store.errors.branche,
    load: () => contoId && store.loadBranche(contoId, { force: true })
  };
};

export const useSottoconti = (brancaId: number | null) => {
  const store = useContiStore();
  
  useEffect(() => {
    if (brancaId) store.loadSottoconti(brancaId);
  }, [brancaId, store.loadSottoconti]);

  return {
    sottoconti: brancaId ? (store.sottocontiByBranca[brancaId] || []) : [],
    isLoading: store.isLoading,
    error: store.errors.sottoconti,
    load: () => brancaId && store.loadSottoconti(brancaId, { force: true })
  };
};