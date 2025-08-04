import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  // Stati della sidebar
  visible: boolean;           // Aperta/Chiusa (per mobile)
  unfoldable: boolean;        // Minimizzata (solo icone)
  
  // Azioni
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleMinimize: () => void;
  setUnfoldable: (unfoldable: boolean) => void;
  
  // Responsive helpers
  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      // Stati iniziali
      visible: true,
      unfoldable: false,
      isMobile: false,

      // Toggle visibilità sidebar (principalmente per mobile)
      toggleSidebar: () => {
        set((state) => ({ visible: !state.visible }));
      },

      // Imposta visibilità sidebar
      setSidebarVisible: (visible: boolean) => {
        set({ visible });
      },

      // Toggle minimize/expand (mostra solo icone)
      toggleMinimize: () => {
        set((state) => ({ unfoldable: !state.unfoldable }));
      },

      // Imposta stato minimizzato
      setUnfoldable: (unfoldable: boolean) => {
        set({ unfoldable });
      },

      // Imposta se siamo su mobile
      setIsMobile: (isMobile: boolean) => {
        const currentState = get();
        set({ 
          isMobile,
          // Su mobile, forza la sidebar chiusa per default
          // Su desktop, mostra la sidebar di default
          visible: isMobile ? false : true,
          // Su mobile, disabilita minimize per avere comportamento slide
          unfoldable: isMobile ? false : currentState.unfoldable
        });
      },
    }),
    {
      name: 'sidebar-storage',
      // Persistiamo solo alcuni stati, non isMobile che deve essere calcolato runtime
      partialize: (state) => ({ 
        visible: state.visible, 
        unfoldable: state.unfoldable 
      }),
    }
  )
);