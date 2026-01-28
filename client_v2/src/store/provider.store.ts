import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { worksService } from '@/services/works.service';
import { Provider } from '@/types/works.types';
import { LoadingState } from '@/types';

interface ProviderState {
  providers: Provider[];
  loading: LoadingState;
  error: string | null;
}

interface ProviderActions {
  loadProviders: () => Promise<void>;
  createProvider: (provider: Partial<Provider>) => Promise<Provider | null>;
  updateProvider: (id: number, provider: Partial<Provider>) => Promise<Provider | null>;
  deleteProvider: (id: number) => Promise<boolean>;
}

export const useProviderStore = create<ProviderState & ProviderActions>()(
  immer((set, get) => ({
    providers: [],
    loading: 'idle',
    error: null,

    loadProviders: async () => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const data = await worksService.getAllProviders();
        set(state => { state.providers = data; state.loading = 'success'; });
      } catch (err: any) {
        set(state => { state.error = err.message || 'Error loading providers'; state.loading = 'error'; });
      }
    },

    createProvider: async (provider) => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const newProvider = await worksService.createProvider(provider);
        set(state => { state.providers.push(newProvider); state.loading = 'success'; });
        return newProvider;
      } catch (err: any) {
        set(state => { state.error = err.message || 'Error creating provider'; state.loading = 'error'; });
        return null;
      }
    },

    updateProvider: async (id, provider) => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const updatedProvider = await worksService.updateProvider(id, provider);
        set(state => {
          const index = state.providers.findIndex(p => p.id === id);
          if (index !== -1) {
            state.providers[index] = updatedProvider;
          }
          state.loading = 'success';
        });
        return updatedProvider;
      } catch (err: any) {
        set(state => { state.error = err.message || 'Error updating provider'; state.loading = 'error'; });
        return null;
      }
    },

    deleteProvider: async (id) => {
      set(state => { loading: 'loading'; state.error = null; });
      try {
        await worksService.deleteProvider(id);
        set(state => {
          state.providers = state.providers.filter(p => p.id !== id);
          state.loading = 'success';
        });
        return true;
      } catch (err: any) {
        set(state => { state.error = err.message || 'Error deleting provider'; state.loading = 'error'; });
        return false;
      }
    }
  }))
);
