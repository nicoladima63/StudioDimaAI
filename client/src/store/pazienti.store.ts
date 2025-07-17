// src/store/pazienti.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  PazienteCompleto, 
  StatistichePazienti, 
  CittaData, 
  ViewType, 
  PriorityFilter, 
  StatusFilter 
} from '@/lib/types';

interface PazientiStore {
  // Dati
  pazienti: PazienteCompleto[];
  statistiche: StatistichePazienti | null;
  cittaData: CittaData[];
  lastKnownCount: number;
  
  // UI State
  isLoading: boolean;
  currentView: ViewType;
  searchTerm: string;
  priorityFilter: PriorityFilter | null;
  statusFilter: StatusFilter | null;
  selectedCitta: string | null;
  
  // Actions - Data Management
  setPazienti: (pazienti: PazienteCompleto[]) => void;
  setStatistiche: (stats: StatistichePazienti) => void;
  setCittaData: (data: CittaData[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Actions - UI State
  setCurrentView: (view: ViewType) => void;
  setSearchTerm: (term: string) => void;
  setPriorityFilter: (priority: PriorityFilter | null) => void;
  setStatusFilter: (status: StatusFilter | null) => void;
  setSelectedCitta: (citta: string | null) => void;
  clearFilters: () => void;
  
  // Getters - Data Access
  getAllPazienti: () => PazienteCompleto[];
  getRichiami: () => PazienteCompleto[];
  getPazienteById: (id: string) => PazienteCompleto | undefined;
  getPazientiByNome: (nome: string) => PazienteCompleto[];
  getPazientiOfComune: (comune: string) => PazienteCompleto[];
  
  // Getters - Filtered Data
  getFilteredPazienti: () => PazienteCompleto[];
  getFilteredRichiami: () => PazienteCompleto[];
  getFilteredCitta: () => CittaData[];
  
  // Utilities
  refreshData: () => void;
}

export const usePazientiStore = create<PazientiStore>()(
  persist(
    (set, get) => ({
      // Initial State
      pazienti: [],
      statistiche: null,
      cittaData: [],
      lastKnownCount: 0,
      
      // UI State
      isLoading: false,
      currentView: 'all',
      searchTerm: '',
      priorityFilter: null,
      statusFilter: null,
      selectedCitta: null,
      
      // Actions - Data Management
      setPazienti: (pazienti) => set({ 
        pazienti, 
        lastKnownCount: pazienti.length 
      }),
      
      setStatistiche: (statistiche) => set({ statistiche }),
      
      setCittaData: (cittaData) => set({ cittaData }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      // Actions - UI State
      setCurrentView: (currentView) => set({ currentView }),
      
      setSearchTerm: (searchTerm) => set({ searchTerm }),
      
      setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
      
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      
      setSelectedCitta: (selectedCitta) => set({ selectedCitta }),
      
      clearFilters: () => set({ 
        searchTerm: '',
        priorityFilter: null,
        statusFilter: null,
        selectedCitta: null
      }),
      
      // Getters - Data Access
      getAllPazienti: () => get().pazienti,
      
      getRichiami: () => get().pazienti.filter(p => p.needs_recall),
      
      getPazienteById: (id) => get().pazienti.find(p => p.DB_CODE === id),
      
      getPazientiByNome: (nome) => {
        const query = nome.toLowerCase();
        return get().pazienti.filter(p => 
          p.nome_completo.toLowerCase().includes(query) ||
          p.DB_PANOME.toLowerCase().includes(query)
        );
      },
      
      getPazientiOfComune: (comune) => get().pazienti.filter(p => 
        p.citta_clean.toLowerCase() === comune.toLowerCase()
      ),
      
      // Getters - Filtered Data
      getFilteredPazienti: () => {
        const { pazienti, searchTerm, selectedCitta } = get();
        let filtered = pazienti;
        
        // Filtro per nome
        if (searchTerm) {
          const query = searchTerm.toLowerCase();
          filtered = filtered.filter(p => 
            p.nome_completo.toLowerCase().includes(query) ||
            p.DB_PANOME.toLowerCase().includes(query)
          );
        }
        
        // Filtro per città
        if (selectedCitta) {
          filtered = filtered.filter(p => p.citta_clean === selectedCitta);
        }
        
        return filtered;
      },
      
      getFilteredRichiami: () => {
        const { pazienti, searchTerm, priorityFilter, statusFilter, selectedCitta } = get();
        let filtered = pazienti.filter(p => p.needs_recall);
        
        // Filtro per nome
        if (searchTerm) {
          const query = searchTerm.toLowerCase();
          filtered = filtered.filter(p => 
            p.nome_completo.toLowerCase().includes(query) ||
            p.DB_PANOME.toLowerCase().includes(query)
          );
        }
        
        // Filtro per priorità
        if (priorityFilter) {
          filtered = filtered.filter(p => p.recall_priority === priorityFilter);
        }
        
        // Filtro per status
        if (statusFilter) {
          filtered = filtered.filter(p => p.recall_status === statusFilter);
        }
        
        // Filtro per città
        if (selectedCitta) {
          filtered = filtered.filter(p => p.citta_clean === selectedCitta);
        }
        
        // Ordinamento per priorità e giorni
        const priorityOrder = { high: 3, medium: 2, low: 1, none: 0 };
        return filtered.sort((a, b) => {
          const priorityDiff = priorityOrder[b.recall_priority] - priorityOrder[a.recall_priority];
          if (priorityDiff !== 0) return priorityDiff;
          
          return (b.giorni_ultima_visita || 0) - (a.giorni_ultima_visita || 0);
        });
      },
      
      getFilteredCitta: () => {
        const { cittaData, searchTerm } = get();
        let filtered = cittaData;
        
        if (searchTerm) {
          const query = searchTerm.toLowerCase();
          filtered = filtered.filter(c => 
            c.citta.toLowerCase().includes(query)
          );
        }
        
        return filtered.sort((a, b) => b.totale_pazienti - a.totale_pazienti);
      },
      
      // Utilities
      refreshData: () => {
        set({ 
          pazienti: [],
          statistiche: null,
          cittaData: [],
          lastKnownCount: 0
        });
      }
    }),
    {
      name: 'pazienti-storage',
      partialize: (state) => ({ 
        lastKnownCount: state.lastKnownCount,
        currentView: state.currentView
      })
    }
  )
);