// src/store/authStore.ts
import {create} from 'zustand';

interface AuthState {
  token: string | null;
  username: string | null;
  setToken: (token: string, username: string) => void;
  clearToken: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  username: localStorage.getItem('username'),
  setToken: (token, username) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    set({ token, username });
  },
  clearToken: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    set({ token: null, username: null });
  },
}));
