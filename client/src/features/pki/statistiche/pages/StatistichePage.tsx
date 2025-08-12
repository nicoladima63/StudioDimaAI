import React, { useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CTabs,
  CTabList,
  CTab,
  CTabContent,
  CTabPane,
  CContainer,
  CRow,
  CCol
} from '@coreui/react';
import CollaboratoriTab from '../components/CollaboratoriTab';

const StatistichePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <CContainer fluid>
      <CRow>
        <CCol>
          <CCard>
            <CCardHeader>
              <h4 className="mb-0">Statistiche Studio</h4>
              <small className="text-muted">
                Analisi dettagliate per categorie di spesa e produttività
              </small>
            </CCardHeader>
            <CCardBody>
            <CollaboratoriTab />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  );
};

export default StatistichePage;