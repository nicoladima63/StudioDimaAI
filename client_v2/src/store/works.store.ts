import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { worksService } from '@/services/works.service';
import { Work } from '@/types/works.types';
import { LoadingState } from '@/types';

interface WorkState {
  works: Work[];
  loading: LoadingState;
  error: string | null;
}

interface WorkActions {
  loadWorks: () => Promise<void>;
  createWork: (work: Partial<Work>) => Promise<Work | null>;
  updateWork: (id: number, work: Partial<Work>) => Promise<Work | null>;
  deleteWork: (id: number) => Promise<boolean>;
}

export const useWorkStore = create<WorkState & WorkActions>()(
  immer((set, get) => ({
    works: [],
    loading: 'idle',
    error: null,

    loadWorks: async () => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const data = await worksService.getAllWorks();
        set(state => { state.works = data; state.loading = 'success'; });
      } catch (err: any) {
        set(state => { state.error = err.message || 'Error loading works'; state.loading = 'error'; });
      }
    },

    createWork: async (work) => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const newWork = await worksService.createWork(work);
        set(state => { state.works.push(newWork); state.loading = 'success'; });
        return newWork;
      } catch (err: any) {
        set(state => { state.error = err.message || 'Error creating work'; state.loading = 'error'; });
        return null;
      }
    },

    updateWork: async (id, work) => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const updatedWork = await worksService.updateWork(id, work);
        set(state => {
          const index = state.works.findIndex(w => w.id === id);
          if (index !== -1) {
            state.works[index] = updatedWork;
          }
          state.loading = 'success';
        });
        return updatedWork;
      } catch (err: any) {
        set(state => { state.error = err.message || 'Error updating work'; state.loading = 'error'; });
        return null;
      }
    },

    deleteWork: async (id) => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        await worksService.deleteWork(id);
        set(state => {
          state.works = state.works.filter(w => w.id !== id);
          state.loading = 'success';
        });
        return true;
      } catch (err: any) {
        set(state => { state.error = err.message || 'Error deleting work'; state.loading = 'error'; });
        return false;
      }
    }
  }))
);
