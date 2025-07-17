import React from 'react';
import { CRow, CCol, CCard, CCardBody } from '@coreui/react';
import { CIcon } from '@coreui/icons-react';
import { cilPeople, cilCheckCircle, cilXCircle, cilPhone } from '@coreui/icons';

interface PazientiStatsProps {
  stats: {
    totale: number;
    in_cura: number;
    non_in_cura: number;
  };
}

const widgetStyle = {
  borderRadius: 12,

  minHeight: 60,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: 20,
  marginBottom: 8,
  padding: 0,
  borderWidth: 1,
  borderStyle: 'solid' as const,
};

const PazientiStats: React.FC<PazientiStatsProps> = ({ stats }) => (
<CCard className="mb-4">
  <CCardBody className="d-flex align-items-center justify-content-around">
    <div className="d-flex align-items-center">
      <CIcon icon={cilPeople} size="xl" className="text-primary me-3" />
      <div className="text-center">
        <div className="fs-5 fw-semibold text-primary">
          {stats.totale_pazienti}
        </div>
        <div className="text-muted text-uppercase fw-semibold small">
          Totale Pazienti
        </div>
      </div>
    </div>
    
    <div className="d-flex align-items-center">
      <CIcon icon={cilCheckCircle} size="xl" className="text-success me-3" />
      <div className="text-center">
        <div className="fs-5 fw-semibold text-success">
          {stats.in_cura}
        </div>
        <div className="text-muted text-uppercase fw-semibold small">
          In Cura
        </div>
      </div>
    </div>
    
    <div className="d-flex align-items-center">
      <CIcon icon={cilXCircle} size="xl" className="text-danger me-3" />
      <div className="text-center">
        <div className="fs-5 fw-semibold text-danger">
          {stats.non_in_cura}
        </div>
        <div className="text-muted text-uppercase fw-semibold small">
          Non in Cura
        </div>
      </div>
    </div>
    
    <div className="d-flex align-items-center">
      <CIcon icon={cilPhone} size="xl" className="text-info me-3" />
      <div className="text-center">
        <div className="fs-5 fw-semibold text-info">
          {stats.con_cellulare}
        </div>
        <div className="text-muted text-uppercase fw-semibold small">
          Con Cellulare
        </div>
      </div>
    </div>
  </CCardBody>
</CCard>);

export default PazientiStats; 