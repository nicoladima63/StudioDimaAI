import React from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CPlaceholder
} from '@coreui/react';

interface Props {
  count?: number;
}

const StatisticheSkeleton: React.FC<Props> = ({ count = 6 }) => {
  return (
    <div>
      <div className="mb-4">
        <CPlaceholder as="h6" animation="glow">
          <CPlaceholder xs={4} />
        </CPlaceholder>
      </div>

      <CRow>
        {Array.from({ length: count }).map((_, index) => (
          <CCol key={index} md={3} className="mb-4">
            <CCard className="h-100">
              <CCardHeader style={{ height: 80 }}>
                <CPlaceholder animation="glow">
                  <CPlaceholder xs={8} />
                </CPlaceholder>
              </CCardHeader>
              <CCardBody>
                <CRow className="g-2">
                  <CCol xs={12}>
                    <div className="border-start border-2 border-secondary ps-2 mb-2">
                      <CPlaceholder animation="glow">
                        <CPlaceholder xs={6} size="sm" />
                        <CPlaceholder xs={8} />
                      </CPlaceholder>
                    </div>
                  </CCol>
                  <CCol xs={4}>
                    <div className="border-start border-2 border-secondary ps-2">
                      <CPlaceholder animation="glow">
                        <CPlaceholder xs={8} size="sm" />
                        <CPlaceholder xs={6} />
                      </CPlaceholder>
                    </div>
                  </CCol>
                  <CCol xs={4}>
                    <div className="border-start border-2 border-secondary ps-2">
                      <CPlaceholder animation="glow">
                        <CPlaceholder xs={6} size="sm" />
                        <CPlaceholder xs={8} />
                      </CPlaceholder>
                    </div>
                  </CCol>
                  <CCol xs={4}>
                    <div className="border-start border-2 border-secondary ps-2">
                      <CPlaceholder animation="glow">
                        <CPlaceholder xs={10} size="sm" />
                        <CPlaceholder xs={6} />
                      </CPlaceholder>
                    </div>
                  </CCol>
                </CRow>
                
                <div className="mt-3">
                  <CPlaceholder animation="glow">
                    <CPlaceholder xs={6} size="sm" />
                  </CPlaceholder>
                  <div className="d-flex flex-wrap gap-1 mt-2">
                    <CPlaceholder animation="glow">
                      <CPlaceholder xs={3} size="sm" />
                      <CPlaceholder xs={3} size="sm" />
                      <CPlaceholder xs={3} size="sm" />
                    </CPlaceholder>
                  </div>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>
    </div>
  );
};

export default StatisticheSkeleton;