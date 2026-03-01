import React, { useState } from 'react';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';
import Card from '@/components/ui/Card';
import DashboardTab from '../components/DashboardTab';
import ForecastTab from '../components/ForecastTab';
import SimulatoreTab from '../components/SimulatoreTab';

const EconomicsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  return (
    <Card title="Analisi Economica">
      <CNav variant="tabs" className="mb-4">
        <CNavItem>
          <CNavLink
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            Stato Attuale
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'forecast'}
            onClick={() => setActiveTab('forecast')}
            style={{ cursor: 'pointer' }}
          >
            Previsione
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'simulatore'}
            onClick={() => setActiveTab('simulatore')}
            style={{ cursor: 'pointer' }}
          >
            Simulatore
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent>
        <CTabPane visible={activeTab === 'dashboard'}>
          <DashboardTab />
        </CTabPane>
        <CTabPane visible={activeTab === 'forecast'}>
          {activeTab === 'forecast' && <ForecastTab />}
        </CTabPane>
        <CTabPane visible={activeTab === 'simulatore'}>
          {activeTab === 'simulatore' && <SimulatoreTab />}
        </CTabPane>
      </CTabContent>
    </Card>
  );
};

export default EconomicsPage;
