import { useEffect } from 'react';
import { useSidebarStore } from '@/store/useSidebarStore';

// Breakpoint CoreUI per mobile (768px)
const MOBILE_BREAKPOINT = 768;

export const useResponsive = () => {
  const { setIsMobile, setSidebarVisible } = useSidebarStore();

  useEffect(() => {
    const checkIsMobile = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(isMobile);
      
      // Su mobile, chiudi la sidebar per default
      // Su desktop, riapri se era chiusa solo per mobile
      if (isMobile) {
        setSidebarVisible(false);
      }
    };

    // Check iniziale
    checkIsMobile();

    // Listener per resize
    window.addEventListener('resize', checkIsMobile);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, [setIsMobile, setSidebarVisible]);
};