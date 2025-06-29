import React, { useState } from 'react';
import { CCard, CCardBody, CCardHeader, CRow, CCol, CProgress, CCollapse, CButton } from '@coreui/react';
import { cilBell, cilClock, cilCheckCircle, cilWarning, cilChevronBottom, cilChevronTop } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import type { RichiamoStatistics } from '@/api/apiTypes';

interface RecallsStatisticsProps {
  statistics: RichiamoStatistics;
  loading?: boolean;
}

const RecallsStatistics: React.FC<RecallsStatisticsProps> = ({ 
  statistics, 
  loading = false 
}) => {
  const [showDistribuzione, setShowDistribuzione] = useState(false);

  if (loading) {
    return (
      <CCard className="mb-4">
        <CCardHeader>
          <h5 className="mb-0">Statistiche Richiami</h5>
        </CCardHeader>
        <CCardBody>
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Caricamento...</span>
            </div>
          </div>
        </CCardBody>
      </CCard>
    );
  }

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <h5 className="mb-0">
          <CIcon icon={cilBell} className="me-2" />
          Statistiche Richiami
        </h5>
      </CCardHeader>
      <CCardBody>
        <CRow>
          <CCol sm={6} lg={3} className="mb-3">
            <div className="d-flex align-items-center">
              <div className="flex-shrink-0">
                <div className="bg-primary rounded-circle p-3">
                  <CIcon icon={cilBell} className="text-white" />
                </div>
              </div>
              <div className="flex-grow-1 ms-3">
                <h6 className="mb-0">{statistics.totale}</h6>
                <small className="text-muted">Totale</small>
              </div>
            </div>
          </CCol>
          
          <CCol sm={6} lg={3} className="mb-3">
            <div className="d-flex align-items-center">
              <div className="flex-shrink-0">
                <div className="bg-danger rounded-circle p-3">
                  <CIcon icon={cilWarning} className="text-white" />
                </div>
              </div>
              <div className="flex-grow-1 ms-3">
                <h6 className="mb-0">{statistics.scaduti}</h6>
                <small className="text-muted">Scaduti</small>
              </div>
            </div>
          </CCol>
          
          <CCol sm={6} lg={3} className="mb-3">
            <div className="d-flex align-items-center">
              <div className="flex-shrink-0">
                <div className="bg-warning rounded-circle p-3">
                  <CIcon icon={cilClock} className="text-white" />
                </div>
              </div>
              <div className="flex-grow-1 ms-3">
                <h6 className="mb-0">{statistics.in_scadenza}</h6>
                <small className="text-muted">In Scadenza</small>
              </div>
            </div>
          </CCol>
          
          <CCol sm={6} lg={3} className="mb-3">
            <div className="d-flex align-items-center">
              <div className="flex-shrink-0">
                <div className="bg-success rounded-circle p-3">
                  <CIcon icon={cilCheckCircle} className="text-white" />
                </div>
              </div>
              <div className="flex-grow-1 ms-3">
                <h6 className="mb-0">{statistics.futuri}</h6>
                <small className="text-muted">Futuri</small>
              </div>
            </div>
          </CCol>
        </CRow>

        {/* Accordion Distribuzione per Tipo */}
        <div className="mt-4">
          <CButton
            color="light"
            className="w-100 text-start mb-2"
            onClick={() => setShowDistribuzione(v => !v)}
            aria-expanded={showDistribuzione}
          >
            <CIcon icon={showDistribuzione ? cilChevronTop : cilChevronBottom} className="me-2" />
            Distribuzione per Tipo
          </CButton>
          <CCollapse visible={showDistribuzione}>
            {Object.keys(statistics.per_tipo).length > 0 ? (
              Object.entries(statistics.per_tipo).map(([tipo, count]) => {
                const percentage = statistics.totale > 0 ? (count / statistics.totale) * 100 : 0;
                return (
                  <div key={tipo} className="mb-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="small">{tipo}</span>
                      <span className="small text-muted">{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <CProgress 
                      value={percentage} 
                      color="primary" 
                      className="mb-2"
                      style={{ height: '6px' }}
                    />
                  </div>
                );
              })
            ) : (
              <div className="text-muted">Nessun dato disponibile</div>
            )}
          </CCollapse>
        </div>
      </CCardBody>
    </CCard>
  );
};

export default RecallsStatistics; 