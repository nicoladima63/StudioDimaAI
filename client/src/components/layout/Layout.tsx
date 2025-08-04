import React from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { useSidebarStore } from '@/store/useSidebarStore';
import Sidebar from './Sidebar';
import AppHeader from './AppHeader';
import AppContent from './AppContent';
import AppFooter from './AppFooter';
import '@/styles/sidebar-responsive.css';

// Layout CoreUI originale identico al template
const Layout: React.FC = () => {
  // Inizializza il responsive behavior
  useResponsive();
  
  const { visible, isMobile, unfoldable, setSidebarVisible } = useSidebarStore();

  // Handler per chiudere sidebar quando si clicca sul backdrop (mobile)
  const handleBackdropClick = () => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  return (
    <div>
      {/* Mobile backdrop */}
      {isMobile && visible && (
        <div 
          className={`sidebar-backdrop ${visible ? 'show' : ''}`}
          onClick={handleBackdropClick}
        />
      )}
      
      <Sidebar />
      <div 
        className={`
          wrapper d-flex flex-column min-vh-100
          ${!isMobile && visible && !unfoldable ? 'sidebar-visible' : ''}
          ${!isMobile && visible && unfoldable ? 'sidebar-minimized' : ''}
        `}
      >
        <AppHeader />
        <div className="body flex-grow-1">
          <AppContent />
        </div>
        <AppFooter />
      </div>
    </div>
  );
};

export default React.memo(Layout);
