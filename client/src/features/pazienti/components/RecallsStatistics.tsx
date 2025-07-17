// src/features/pazienti/components/RecallsStatistics.tsx
import React from 'react';
import { CRow, CCol, CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react';
import { CIcon } from '@coreui/icons-react';
import { cilPhone, cilClock, cilWarning, cilCheckCircle, cilChart } from '@coreui/icons';

interface RecallsStatisticsProps {
  statistics: {
    totale_da_richiamare: number;
    priorita_alta: number;
    priorita_media: number;
    priorita_bassa: number;
    scaduti: number;
    in_scadenza: number;
    futuri: number;
    per_tipo: Record<string, number>;
  };
  loading: boolean;
}

const RecallsStatistics: React.FC<RecallsStatisticsProps> = ({ statistics, loading }) => {
  if (loading) {
    return (
      <div className="text-center py-3">
        <CSpinner color="primary" size="sm" />
        <span className="ms-2">Caricamento statistiche...</span>
      </div>
    );
  }

  return (
    <>
      <CRow className="mb-4 justify-content-center">
        <CCol md={2}>
          <CCard>
            <CCardBody className="d-flex align-items-center">
              <CIcon icon={cilPhone} size="xl" className="text-primary me-3" />
              <div>
                <div className="fs-5 fw-semibold text-primary">
                  {statistics.totale_da_richiamare}
                </div>
                <div className="text-muted text-uppercase fw-semibold small">
                  Totale Richiami
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        
        <CCol md={2}>
          <CCard>
            <CCardBody className="d-flex align-items-center">
              <CIcon icon={cilWarning} size="xl" className="text-danger me-3" />
              <div>
                <div className="fs-5 fw-semibold text-danger">
                  {statistics.priorita_alta}
                </div>
                <div className="text-muted text-uppercase fw-semibold small">
                  Alta Priorità
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        
        <CCol md={2}>
          <CCard>
            <CCardBody className="d-flex align-items-center">
              <CIcon icon={cilClock} size="xl" className="text-warning me-3" />
              <div>
                <div className="fs-5 fw-semibold text-warning">
                  {statistics.scaduti}
                </div>
                <div className="text-muted text-uppercase fw-semibold small">
                  Scaduti
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        
        <CCol md={2}>
          <CCard>
            <CCardBody className="d-flex align-items-center">
              <CIcon icon={cilCheckCircle} size="xl" className="text-success me-3" />
              <div>
                <div className="fs-5 fw-semibold text-success">
                  {statistics.in_scadenza}
                </div>
                <div className="text-muted text-uppercase fw-semibold small">
                  In Scadenza
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={2}>
          <CCard>
            <CCardBody className="d-flex align-items-center">
              <CIcon icon={cilChart} size="xl" className="text-info me-3" />
              <div>
                <div className="fs-5 fw-semibold text-info">
                  {Object.entries(statistics.per_tipo)[0]?.[1] || 0}
                </div>
                <div className="text-muted text-uppercase fw-semibold small">
                  {Object.entries(statistics.per_tipo)[0]?.[0] || 'Sconosciuto'}
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
};

export default RecallsStatistics;