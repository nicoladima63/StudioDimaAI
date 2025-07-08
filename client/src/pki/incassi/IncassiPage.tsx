import React from 'react';
import { CRow, CCol } from '@coreui/react';
import IncassiDashboard from './components/IncassiDashboard';

const IncassiPage: React.FC = () => {
  return (
    <CRow className="justify-content-center">
      <CCol xs={12} md={10} lg={8}>
        <IncassiDashboard />
      </CCol>
    </CRow>
  );
};

export default IncassiPage; 