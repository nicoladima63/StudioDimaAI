import React from 'react';
import { CFooter } from '@coreui/react';

const AppFooter: React.FC = () => {
  return (
    <CFooter className="px-4">
      <div>
        <span className="ms-1">&copy; 2024 Studio Di Martino.</span>
      </div>
      <div className="ms-auto">
        <span className="me-1">Gestionale Studio Dentistico</span>
      </div>
    </CFooter>
  );
};

export default React.memo(AppFooter);