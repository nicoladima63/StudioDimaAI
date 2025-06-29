import React from 'react';
import { CCard, CCardBody, CRow, CCol } from '@coreui/react';

interface PazientiStatsProps {
  stats: {
    totale: number;
    in_cura: number;
    non_in_cura: number;
  };
}

const PazientiStats: React.FC<PazientiStatsProps> = ({ stats }) => (
  <CCard className="mb-4">
    <CCardBody>
      <CRow>
        <CCol sm={4} className="text-center">
          <div className="fw-bold" style={{ fontSize: 24 }}>{stats.totale}</div>
          <div className="text-muted">Totale pazienti</div>
        </CCol>
        <CCol sm={4} className="text-center">
          <div className="fw-bold text-success" style={{ fontSize: 24 }}>{stats.in_cura}</div>
          <div className="text-muted">In cura</div>
        </CCol>
        <CCol sm={4} className="text-center">
          <div className="fw-bold text-danger" style={{ fontSize: 24 }}>{stats.non_in_cura}</div>
          <div className="text-muted">Non in cura</div>
        </CCol>
      </CRow>
    </CCardBody>
  </CCard>
);

export default PazientiStats; 