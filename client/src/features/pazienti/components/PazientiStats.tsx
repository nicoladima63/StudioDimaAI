import React from 'react';
import { CCard, CCardBody } from '@coreui/react';
import { CIcon } from '@coreui/icons-react';
import { cilPeople, cilCheckCircle, cilXCircle, cilPhone } from '@coreui/icons';
import type { StatistichePazienti } from '@/lib/types';

interface PazientiStatsProps {
  stats: StatistichePazienti;
}


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