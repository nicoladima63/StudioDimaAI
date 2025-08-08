import React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/api/client';

export interface Branca {
  id: number;
  contoid: number;
  nome: string;
  conto_nome?: string;
}

interface BrancheState {
  // State
  branche: Branca[];
  brancheByParent: Record<number, Branca[]>;
  lastUpdate: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadBranche: () => Promise<void>;
  getBranche: (contoId?: number) => Promise<Branca[]>;
  invalidateCache: () => void;
  checkAndUpdateCache: () => Promise<boolean>;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

export const useBrancheStore = create<BrancheState>()(
  persist(
    (set, get) => ({
      // Initial state
      branche: [],
      brancheByParent: {},
      lastUpdate: 0,
      isLoading: false,
      error: null,

      // Controlla se il cache è valido e aggiorna se necessario
      checkAndUpdateCache: async (): Promise<boolean> => {
        const state = get();
        const now = Date.now();

        // Controlla scadenza temporale
        if (now - state.lastUpdate > CACHE_DURATION) {
          console.log('Cache branche scaduto per tempo, ricaricamento...');
          await get().loadBranche();
          return true;
        }

        return false; // Cache valido
      },

      // Carica tutte le branche dal server
      loadBranche: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get('/api/struttura-conti/branche');
          if (!response.data.success) {
            throw new Error('Errore nel caricamento branche');
          }

          const branche: Branca[] = response.data.data;
          const brancheByParent: Record<number, Branca[]> = {};

          // Raggruppa branche per conto padre
          branche.forEach(branca => {
            if (!brancheByParent[branca.contoid]) {
              brancheByParent[branca.contoid] = [];
            }
            brancheByParent[branca.contoid].push(branca);
          });

          set({
            branche,
            brancheByParent,
            lastUpdate: Date.now(),
            isLoading: false,
            error: null
          });

          console.log(`Branche caricate: ${branche.length} branche per ${Object.keys(brancheByParent).length} conti`);

        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Errore nel caricamento branche'
          });
          throw error;
        }
      },

      // Ottieni branche per un conto (con lazy loading se necessario)
      getBranche: async (contoId?: number): Promise<Branca[]> => {
        // Controlla e aggiorna cache se necessario
        await get().checkAndUpdateCache();

        // Restituisci branche dal cache
        const currentState = get();
        if (contoId) {
          return currentState.brancheByParent[contoId] || [];
        }
        return currentState.branche;
      },

      // Invalida cache
      invalidateCache: () => {
        set({
          branche: [],
          brancheByParent: {},
          lastUpdate: 0,
          error: null
        });
      },
    }),
    {
      name: 'branche-storage',
      partialize: (state) => ({
        branche: state.branche,
        brancheByParent: state.brancheByParent,
        lastUpdate: state.lastUpdate
      })
    }
  )
);

// Hook personalizzati per uso semplificato
export const useBranche = (contoId?: number) => {
  const { getBranche, isLoading, error } = useBrancheStore();
  const [branche, setBranche] = React.useState<Branca[]>([]);
  const [loadingBranche, setLoadingBranche] = React.useState(false);

  React.useEffect(() => {
    const loadBranche = async () => {
      setLoadingBranche(true);
      try {
        const result = await getBranche(contoId);
        setBranche(result);
      } catch (error) {
        console.error('Errore caricamento branche:', error);
        setBranche([]);
      } finally {
        setLoadingBranche(false);
      }
    };

    loadBranche();
  }, [contoId, getBranche]);

  return { branche, isLoading: loadingBranche, error };
};