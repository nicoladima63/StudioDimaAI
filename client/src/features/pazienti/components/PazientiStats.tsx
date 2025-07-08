import React from 'react';
import { CRow, CCol, CCard, CCardBody } from '@coreui/react';

interface PazientiStatsProps {
  stats: {
    totale: number;
    in_cura: number;
    non_in_cura: number;
  };
}

const widgetStyle = {
  borderRadius: 12,
  color: '#fff',
  minHeight: 60,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: 20,
  marginBottom: 8,
  padding: 0,
};

const PazientiStats: React.FC<PazientiStatsProps> = ({ stats }) => (
  <CRow className="mb-4 g-3">
    <CCol xs={12} md={4}>
      <CCard style={{ ...widgetStyle, background: '#6f42c1' }}>
        <CCardBody className="text-center p-2">
          <div style={{ fontSize: 24 }}>{stats.totale}</div>
          <div style={{ fontSize: 13, fontWeight: 400, color: '#e0d7f7' }}>Totale pazienti</div>
        </CCardBody>
      </CCard>
    </CCol>
    <CCol xs={12} md={4}>
      <CCard style={{ ...widgetStyle, background: '#198754' }}>
        <CCardBody className="text-center p-2">
          <div style={{ fontSize: 24 }}>{stats.in_cura}</div>
          <div style={{ fontSize: 13, fontWeight: 400, color: '#b6e7c9' }}>In cura</div>
        </CCardBody>
      </CCard>
    </CCol>
    <CCol xs={12} md={4}>
      <CCard style={{ ...widgetStyle, background: '#dc3545' }}>
        <CCardBody className="text-center p-2">
          <div style={{ fontSize: 24 }}>{stats.non_in_cura}</div>
          <div style={{ fontSize: 13, fontWeight: 400, color: '#f7c6ce' }}>Non in cura</div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
);

export default PazientiStats; 