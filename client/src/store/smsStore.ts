// src/store/smsStore.ts - Store dedicato per SMS

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SMSStatus {
  mode: 'test' | 'prod';
  enabled: boolean;
  sender: string;
  api_configured: boolean;
}

export interface SMSStats {
  sent_today: number;
  credits_remaining: number;
  last_updated: string;
}

interface SMSState {
  // Modalità SMS
  mode: 'dev' | 'test' | 'prod';
  setMode: (mode: 'dev' | 'test' | 'prod') => void;
  
  // Stato del servizio
  status: SMSStatus | null;
  setStatus: (status: SMSStatus) => void;
  
  // Statistiche (opzionali per il futuro)
  stats: SMSStats | null;
  setStats: (stats: SMSStats) => void;
  
  // Stato UI
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Ultimo test di connessione
  lastTestResult: {
    success: boolean;
    message: string;
    timestamp: number;
  } | null;
  setLastTestResult: (result: { success: boolean; message: string }) => void;
  
  // Helper methods
  isEnabled: () => boolean;
  canSendSMS: () => boolean;
  reset: () => void;
}

export const useSMSStore = create<SMSState>()(
  persist(
    (set, get) => ({
      // Initial state
      mode: 'dev',
      status: null,
      stats: null,
      isLoading: false,
      lastTestResult: null,

      // Setters
      setMode: (mode) => set({ mode }),
      setStatus: (status) => set({ status }),
      setStats: (stats) => set({ stats }),
      setLoading: (isLoading) => set({ isLoading }),
      
      setLastTestResult: (result) => 
        set({ 
          lastTestResult: {
            ...result,
            timestamp: Date.now()
          }
        }),

      // Helper methods
      isEnabled: () => {
        const { status } = get();
        return status?.enabled ?? false;
      },

      canSendSMS: () => {
        const { status, mode } = get();
        return status?.enabled && mode !== 'dev';
      },

      reset: () => set({
        mode: 'dev',
        status: null,
        stats: null,
        isLoading: false,
        lastTestResult: null,
      }),
    }),
    {
      name: 'sms-storage',
      storage: createJSONStorage(() => localStorage),
      // Persisti tutto tranne isLoading che è uno stato temporaneo
      partialize: (state) => ({
        mode: state.mode,
        status: state.status,
        stats: state.stats,
        lastTestResult: state.lastTestResult,
      }),
    }
  )
);

// Selettori per ottimizzare le performance
export const useSMSMode = () => useSMSStore((state) => state.mode);
export const useSMSStatus = () => useSMSStore((state) => state.status);
export const useSMSLoading = () => useSMSStore((state) => state.isLoading);
export const useSMSEnabled = () => useSMSStore((state) => state.isEnabled());
export const useCanSendSMS = () => useSMSStore((state) => state.canSendSMS());