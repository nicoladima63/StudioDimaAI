import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import TestInvioRicetta from '../components/TestInvioRicetta';
import RicettaAuthStatus from '../components/RicettaAuthStatus';
import ListaRicetteTest from '../components/ListaRicetteTest';
import TestSistemaTSRaw from '../components/TestSistemaTSRaw';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';

const RicetteTestPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('test');

  return (
    <div>
      <Card 
        title="Test e Gestione Ricette"
        headerAction={<RicettaAuthStatus />}
      >
        {/* Navigation Tabs */}
        <CNav variant="tabs" role="tablist">
          <CNavItem>
            <CNavLink
              active={activeTab === 'test'}
              onClick={() => setActiveTab('test')}
              role="tab"
            >
              🧪 Test Invio
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'lista'}
              onClick={() => setActiveTab('lista')}
              role="tab"
            >
              📋 Lista Ricette
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'ts-raw'}
              onClick={() => setActiveTab('ts-raw')}
              role="tab"
            >
              🌐 Test Sistema TS
            </CNavLink>
          </CNavItem>
        </CNav>

        {/* Tab Content */}
        <CTabContent className="mt-4">
          <CTabPane visible={activeTab === 'test'} role="tabpanel">
            <TestInvioRicetta />
          </CTabPane>

          <CTabPane visible={activeTab === 'lista'} role="tabpanel">
            <ListaRicetteTest />
          </CTabPane>

          <CTabPane visible={activeTab === 'ts-raw'} role="tabpanel">
            <TestSistemaTSRaw />
          </CTabPane>
        </CTabContent>
      </Card>
    </div>
  )
};

export default RicetteTestPage;