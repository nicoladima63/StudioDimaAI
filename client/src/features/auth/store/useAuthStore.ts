// src/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Costanti per evitare magic strings
interface AuthState {
  token: string | null;
  refreshToken: string | null;
  username: string | null;
  isAuthenticated: boolean;
  setToken: (token: string, refreshToken: string, username: string) => void;
  setAccessToken: (token: string) => void;
  clearToken: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      username: null,
      isAuthenticated: false,
      setToken: (token, refreshToken, username) => {
        set({ token, refreshToken, username, isAuthenticated: true });
      },
      setAccessToken: (token) => {
        set({ token, isAuthenticated: Boolean(token) });
      },
      clearToken: () => {
        set({
          token: null,
          refreshToken: null,
          username: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        username: state.username,
      }),
      onRehydrateStorage: () => (state) => {
        // Ricostruisce isAuthenticated dopo il caricamento dal localStorage
        if (state?.token) {
          state.isAuthenticated = true;
        }
      },
    }
  )
);

// Store per la modalità ambiente (dev/prod) - AGGIORNATO
interface EnvState {
  mode: 'dev' | 'prod';
  setMode: (mode: 'dev' | 'prod') => void;
  rentriMode: 'dev' | 'prod';
  setRentriMode: (mode: 'dev' | 'prod') => void;
  ricettaMode: 'dev' | 'prod';
  setRicettaMode: (mode: 'dev' | 'prod') => void;
  smsMode:  'test' | 'prod';  // AGGIUNTO
  setSmsMode: (mode:  'test' | 'prod') => void;  // AGGIUNTO
}

export const useEnvStore = create<EnvState>()(
  persist(
    (set) => ({
      mode: 'dev',
      setMode: (mode) => set({ mode }),
      rentriMode: 'dev',
      setRentriMode: (mode) => set({ rentriMode: mode }),
      ricettaMode: 'dev',
      setRicettaMode: (mode) => set({ ricettaMode: mode }),
      smsMode: 'test',  // AGGIUNTO
      setSmsMode: (mode) => set({ smsMode: mode }),  // AGGIUNTO
    }),
    {
      name: 'env-mode',
      storage: createJSONStorage(() => localStorage),
    }
  )
);