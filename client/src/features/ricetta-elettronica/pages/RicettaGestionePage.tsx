import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import GestioneProtocolli from '../components/GestioneProtocolli';
import TestInvioRicetta from '../components/TestInvioRicetta';
import RicettaAuthStatus from '../components/RicettaAuthStatus';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';

const RicettaGestionePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('protocolli');

  return (
    <div>
      <Card 
        title="Gestione Ricette Elettroniche"
        headerAction={<RicettaAuthStatus />}
      >
        {/* Navigation Tabs */}
        <CNav variant="tabs" role="tablist">
          <CNavItem>
            <CNavLink
              active={activeTab === 'protocolli'}
              onClick={() => setActiveTab('protocolli')}
              role="tab"
            >
              ⚙️ Gestione Protocolli
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'test'}
              onClick={() => setActiveTab('test')}
              role="tab"
            >
              🧪 Test Invio
            </CNavLink>
          </CNavItem>
        </CNav>

        {/* Tab Content */}
        <CTabContent className="mt-4">
          <CTabPane visible={activeTab === 'protocolli'} role="tabpanel">
            <GestioneProtocolli />
          </CTabPane>

          <CTabPane visible={activeTab === 'test'} role="tabpanel">
            <TestInvioRicetta />
          </CTabPane>
        </CTabContent>
      </Card>
    </div>
  )
};

export default RicettaGestionePage;