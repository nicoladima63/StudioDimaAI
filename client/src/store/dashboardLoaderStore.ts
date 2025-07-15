import { create } from 'zustand';

interface DashboardLoaderState {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

export const useDashboardLoader = create<DashboardLoaderState>((set) => ({
  isLoading: false,
  setLoading: (loading: boolean) => set({ isLoading: loading }),

  loadingMessage: '',
  setLoadingMessage: (message: string) => set({ loadingMessage: message }),

  refreshKey: 0,
  triggerRefresh: () =>
    set((state) => ({ 
      refreshKey: state.refreshKey + 1,
      isLoading: true,
      loadingMessage: 'Caricamento dati in corso...'
    })),
}));
