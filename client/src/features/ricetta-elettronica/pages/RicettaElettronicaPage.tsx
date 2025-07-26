import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import RicettaAvanzata from '../components/RicettaAvanzata';
import RicettaAuthStatus from '../components/RicettaAuthStatus';
import GestioneProtocolli from '../components/GestioneProtocolli';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';

// Dati reali del medico
const datiMedico = {
  regione: '090', // Toscana
  regioneOrdine: 'Firenze',
  ambito: 'Odontoiatria',
  specializzazione: 'F', // Odontoiatra
  iscrizione: '591', // Sostituisci con il tuo numero
  indirizzo: 'Via Michelangelo Buonarroti,15', // Sostituisci con l'indirizzo reale
  telefono: '0574712060', // Sostituisci con il tuo telefono
  cap: '51031', // CAP di Agliana
  citta: 'Agliana',
  provincia: 'PT',
  asl: '109', // ASL Toscana Centro
  cfMedico: 'DMRNCL63S21D612I' // Il tuo CF reale
};

const RicettaElettronicaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ricette');

  return (
    <div>
      <Card 
        title="Ricette Elettroniche"
        headerAction={<RicettaAuthStatus />}
      >
        {/* Navigation Tabs */}
        <CNav variant="tabs" role="tablist">
          <CNavItem>
            <CNavLink
              active={activeTab === 'ricette'}
              onClick={() => setActiveTab('ricette')}
              role="tab"
            >
              📋 Compilazione Ricette
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'protocolli'}
              onClick={() => setActiveTab('protocolli')}
              role="tab"
            >
              ⚙️ Gestione Protocolli
            </CNavLink>
          </CNavItem>
        </CNav>

        {/* Tab Content */}
        <CTabContent className="mt-4">
          <CTabPane visible={activeTab === 'ricette'} role="tabpanel">
            <RicettaAvanzata datiMedico={datiMedico} />
          </CTabPane>

          <CTabPane visible={activeTab === 'protocolli'} role="tabpanel">
            <GestioneProtocolli />
          </CTabPane>
        </CTabContent>
      </Card>
    </div>
  )
};

export default RicettaElettronicaPage; 