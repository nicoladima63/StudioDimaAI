import React, { useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CContainer,
  CRow,
  CCol
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilUser, cilChart, cilBuilding, cilSpeedometer } from '@coreui/icons';
import CollaboratoriTab from '../components/CollaboratoriTab';
import UtenzeTab from '../components/UtenzeTab';
import StudioTab from '../components/StudioTab';
import AutostradaTab from '../components/AutostradaTab';

const StatistichePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('collaboratori');

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
              {/* Navigation Tabs */}
              <CNav variant="tabs" className="mb-4">
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'collaboratori'}
                    onClick={() => setActiveTab('collaboratori')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilUser} className="me-2" />
                    Collaboratori
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'utenze'}
                    onClick={() => setActiveTab('utenze')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilChart} className="me-2" />
                    Utenze
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'studio'}
                    onClick={() => setActiveTab('studio')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilBuilding} className="me-2" />
                    Studio
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'autostrada'}
                    onClick={() => setActiveTab('autostrada')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilSpeedometer} className="me-2" />
                    Autostrada
                  </CNavLink>
                </CNavItem>
              </CNav>

              {/* Tab Content */}
              <CTabContent>
                <CTabPane visible={activeTab === 'collaboratori'} role="tabpanel">
                  <CollaboratoriTab />
                </CTabPane>
                <CTabPane visible={activeTab === 'utenze'} role="tabpanel">
                  <UtenzeTab />
                </CTabPane>
                <CTabPane visible={activeTab === 'studio'} role="tabpanel">
                  <StudioTab />
                </CTabPane>
                <CTabPane visible={activeTab === 'autostrada'} role="tabpanel">
                  <AutostradaTab />
                </CTabPane>
              </CTabContent>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  );
};

export default StatistichePage;