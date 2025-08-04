import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CContainer, CSpinner } from '@coreui/react';

const AppContent: React.FC = () => {
  const location = useLocation();
  
  // Puoi personalizzare il comportamento del container basandoti sulla route
  const isDashboard = location.pathname === '/';

  return (
    <CContainer className="h-auto px-4" fluid>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Outlet />
      </Suspense>
    </CContainer>
  );
};

export default React.memo(AppContent);