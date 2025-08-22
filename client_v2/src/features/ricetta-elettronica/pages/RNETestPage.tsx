import React, { useState } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';
import TestInvioRicetta from '../components/TestInvioRicetta';
import ListaRicetteTest from '../components/ListaRicetteTest';

const RNETestPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'test' | 'lista' | 'ts-raw'>('test');

  return (
    <PageLayout>
      <PageLayout.Header title="Test invio e list Ricette Elettroniche"/>
      <PageLayout.Content>
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
        </CNav>
        <CTabContent className="mt-4">
          <CTabPane visible={activeTab === 'test'} role="tabpanel">
            <TestInvioRicetta />
          </CTabPane>
          <CTabPane visible={activeTab === 'lista'} role="tabpanel">
            <ListaRicetteTest />
          </CTabPane>
        </CTabContent>
      </PageLayout.Content>
    </PageLayout>
  );
};

export default RNETestPage;
