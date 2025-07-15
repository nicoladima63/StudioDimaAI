// src/stores/pazienti.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Paziente } from '@/lib/types';

interface PazientiStore {
  pazienti: Paziente[];
  lastKnownCount: number; // ✅ Ultimo conteggio conosciuto
  isLoading: boolean;
  
  // Actions
  setPazienti: (pazienti: Paziente[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Getters/Filters
  getPazienteById: (id: number) => Paziente | undefined;
  getPazienteByNome: (nome: string) => Paziente[];
  getPazientiOfComune: (comune: string) => Paziente[];
}

export const usePazientiStore = create<PazientiStore>()(
  persist(
    (set, get) => ({
      pazienti: [],
      lastKnownCount: 0, // ✅ Persiste tra sessioni
      isLoading: false,

      setPazienti: (pazienti) => set({ 
        pazienti, 
        lastKnownCount: pazienti.length // ✅ Aggiorna contatore
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),

      // Getters/Filters (invariati)
      getPazienteById: (id) => {
        const { pazienti } = get();
        return pazienti.find(p => p.id === id);
      },

      getPazienteByNome: (nome) => {
        const { pazienti } = get();
        const query = nome.toLowerCase();
        return pazienti.filter(p => 
          p.nome.toLowerCase().includes(query) ||
          p.cognome.toLowerCase().includes(query)
        );
      },

      getPazientiOfComune: (comune) => {
        const { pazienti } = get();
        return pazienti.filter(p => 
          p.comune.toLowerCase() === comune.toLowerCase()
        );
      }
    }),
    {
      name: 'pazienti-storage',
      partialize: (state) => ({ 
        lastKnownCount: state.lastKnownCount // ✅ Persiste solo il contatore
      })
    }
  )
);