// src/components/Layout.tsx
import React from 'react';
import { CContainer, CRow, CCol } from '@coreui/react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  sidebarWidth?: number;
  contentClassName?: string;
}

const DEFAULT_SIDEBAR_WIDTH = 2;

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  sidebarWidth = DEFAULT_SIDEBAR_WIDTH, 
  contentClassName = 'p-4' 
}) => {
  const contentWidth = 12 - sidebarWidth;

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <CRow className="g-0 flex-grow-1">
        <CCol xs={sidebarWidth} className="bg-light">
          <Sidebar />
        </CCol>
        <CCol 
          xs={contentWidth} 
          className={contentClassName}
          as="main"
        >
          <CContainer fluid className="h-100">
            {children}
          </CContainer>
        </CCol>
      </CRow>
    </div>
  );
};

export default React.memo(Layout);
