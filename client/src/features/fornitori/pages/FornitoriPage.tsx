import React, { useState } from 'react';
import {
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
} from '@coreui/react';
import Card from '@/components/ui/Card';
import FornitoriView from '../components/FornitoriView';
import TutteLeFatture from '../components/TutteLeFatture';

const FornitoriPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("elenco");

  return (
    <Card title="Gestione Fornitori">
      <CNav variant="tabs" className="mb-3">
        <CNavItem>
          <CNavLink
            active={activeTab === "elenco"}
            onClick={() => setActiveTab("elenco")}
            style={{ cursor: "pointer" }}
          >
            Classificazione
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === "fatture"}
            onClick={() => setActiveTab("fatture")}
            style={{ cursor: "pointer" }}
          >
            Fatture
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent>
        <CTabPane visible={activeTab === "elenco"}>
          <FornitoriView />
        </CTabPane>
        <CTabPane visible={activeTab === "fatture"}>
          <TutteLeFatture />
        </CTabPane>
      </CTabContent>
    </Card>
  );
};

export default FornitoriPage;