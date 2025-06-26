// src/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Costanti per evitare magic strings
const TOKEN_KEY = 'auth_token';
const USERNAME_KEY = 'auth_username';

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  setToken: (token: string, username: string) => void;
  clearToken: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      isAuthenticated: false,
      setToken: (token, username) => {
        set({ token, username, isAuthenticated: true });
      },
      clearToken: () => {
        set({ token: null, username: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage', // chiave unica per lo storage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        token: state.token, 
        username: state.username 
      }),
    }
  )
);

// Helper functions
export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const getStoredUsername = () => localStorage.getItem(USERNAME_KEY);
