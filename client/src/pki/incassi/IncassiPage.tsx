import React from 'react';
import { CCard, CCardBody, CCardHeader, CRow, CCol } from '@coreui/react';
import IncassiDashboard from './components/IncassiDashboard';

const IncassiPage: React.FC = () => {
  return (
    <CRow className="justify-content-center">
      <CCol xs={12} md={10} lg={8}>
        <CCard>
          <CCardHeader>
            <h3 className="mb-0">Gestione Incassi</h3>
          </CCardHeader>
          <CCardBody>
            <IncassiDashboard />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default IncassiPage; 