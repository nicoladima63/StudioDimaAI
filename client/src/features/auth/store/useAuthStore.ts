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
        set({ token });
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
      name: 'auth-storage', // chiave unica per lo storage
      storage: createJSONStorage(() => localStorage),
      // Salva tutto lo stato tranne 'isAuthenticated' che viene derivato
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        username: state.username,
      }),
    }
  )
);

// Store per la modalità ambiente (dev/prod)
interface EnvState {
  mode: 'dev' | 'prod';
  setMode: (mode: 'dev' | 'prod') => void;
}

export const useEnvStore = create<EnvState>()(
  persist(
    (set) => ({
      mode: 'dev',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'env-mode',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
