/**
 * 🏥 Prestazioni Store - Gestione tariffario prestazioni
 * =====================================================
 * 
 * Store Zustand per gestire le prestazioni dal file ONORARIO.DBF
 * raggruppate per categoria per il sistema di monitoraggio.
 * 
 * Author: Claude Code Studio Architect
 * Version: 1.0.0
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import apiClient from '../services/api/client';

// =============================================================================
// TIPI E INTERFACCE
// =============================================================================

export interface Prestazione {
  id: string;
  nome: string;
  costo: number;
  codice_breve: string;
  categoria_id: number;
  categoria_nome: string;
}

export interface CategoriaPrestazioni {
  categoria_id: number;
  categoria_nome: string;
  prestazioni: Prestazione[];
}

export interface PrestazioniState {
  // Stato
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Dati
  categorie: Record<number, CategoriaPrestazioni>;
  categorieList: CategoriaPrestazioni[];
  
  // Azioni
  loadPrestazioni: () => Promise<void>;
  refreshPrestazioni: () => Promise<void>;
  getPrestazioniByCategoria: (categoriaId: number) => CategoriaPrestazioni | null;
  getPrestazioneById: (id: string) => Prestazione | null;
  getPrestazioniByCodiceBreve: (codiceBreve: string) => Prestazione[];
  clearError: () => void;
}

// =============================================================================
// STORE ZUSTAND
// =============================================================================

export const usePrestazioniStore = create<PrestazioniState>()(
  devtools(
    (set, get) => ({
      // Stato iniziale
      isLoading: false,
      error: null,
      lastUpdated: null,
      categorie: {},
      categorieList: [],

      // =======================================================================
      // AZIONI
      // =======================================================================

      loadPrestazioni: async () => {
        const state = get();
        
        // Evita chiamate multiple simultanee
        if (state.isLoading) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get('/prestazioni');
          if (response.data.success) {
            const { data: categorieData } = response.data;
            
            // Converte oggetto in array per facilità d'uso
            const categorieList = Object.values(categorieData).sort(
              (a: any, b: any) => a.categoria_id - b.categoria_id
            );

            set({
              categorie: categorieData,
              categorieList,
              lastUpdated: new Date(),
              isLoading: false,
              error: null
            });

            //console.log(`✅ Prestazioni caricate: ${categorieList.length} categorie`);
          } else {
            throw new Error(response.data.error || 'Errore caricamento prestazioni');
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || error.message || 'Errore sconosciuto';
          
          set({
            error: errorMessage,
            isLoading: false
          });

          console.error('❌ Errore caricamento prestazioni:', errorMessage);
        }
      },

      refreshPrestazioni: async () => {
        console.log('🔄 Refresh prestazioni...');
        await get().loadPrestazioni();
      },

      // =======================================================================
      // GETTERS
      // =======================================================================

      getPrestazioniByCategoria: (categoriaId: number) => {
        const state = get();
        return state.categorie[categoriaId] || null;
      },

      getPrestazioneById: (id: string) => {
        const state = get();
        
        for (const categoria of state.categorieList) {
          const prestazione = categoria.prestazioni.find(p => p.id === id);
          if (prestazione) {
            return prestazione;
          }
        }
        
        return null;
      },

      getPrestazioniByCodiceBreve: (codiceBreve: string) => {
        const state = get();
        const risultati: Prestazione[] = [];
        
        for (const categoria of state.categorieList) {
          const prestazioni = categoria.prestazioni.filter(
            p => p.codice_breve.toLowerCase() === codiceBreve.toLowerCase()
          );
          risultati.push(...prestazioni);
        }
        
        return risultati;
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'prestazioni-store',
      partialize: (state) => ({
        // Persiste solo i dati, non lo stato di loading
        categorie: state.categorie,
        categorieList: state.categorieList,
        lastUpdated: state.lastUpdated
      })
    }
  )
);

// =============================================================================
// HOOKS UTILITY
// =============================================================================

/**
 * Hook per ottenere prestazioni di una categoria specifica
 */
export const usePrestazioniByCategoria = (categoriaId: number) => {
  const { getPrestazioniByCategoria } = usePrestazioniStore();
  return getPrestazioniByCategoria(categoriaId);
};

/**
 * Hook per ottenere una prestazione specifica per ID
 */
export const usePrestazioneById = (id: string) => {
  const { getPrestazioneById } = usePrestazioniStore();
  return getPrestazioneById(id);
};

/**
 * Hook per ottenere prestazioni per codice breve
 */
export const usePrestazioniByCodiceBreve = (codiceBreve: string) => {
  const { getPrestazioniByCodiceBreve } = usePrestazioniStore();
  return getPrestazioniByCodiceBreve(codiceBreve);
};


