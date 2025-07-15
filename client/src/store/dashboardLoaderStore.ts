// server/app/store/dashboardLoaderStore.ts
import { create } from 'zustand';

type LoadingStep =
  | 'idle'
  | 'loading_appointments'
  | 'loading_stats'
  | 'loading_fatture'
  | 'done';

interface DashboardLoaderState {
  loadingStep: LoadingStep;
  setStep: (step: LoadingStep) => void;

  refreshKey: number;                  // 🔁 chiave per forzare il refresh
  triggerRefresh: () => void;          // 🔁 funzione per incrementarla
}

export const useDashboardLoader = create<DashboardLoaderState>((set) => ({
  loadingStep: 'idle',
  setStep: (step) => set({ loadingStep: step }),

  refreshKey: 0,
  triggerRefresh: () =>
    set((state) => ({ refreshKey: state.refreshKey + 1 })),
}));
