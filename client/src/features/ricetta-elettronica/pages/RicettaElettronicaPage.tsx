import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import RicettaElettronica from '../components/RicettaElettronica';
import RicettaAvanzata from '../components/RicettaAvanzata';
import RicettaAuthStatus from '../components/RicettaAuthStatus';
import GestioneProtocolli from '../components/GestioneProtocolli';
import { CButton, CButtonGroup, CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';

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
  const [modalitaAvanzata, setModalitaAvanzata] = useState(true);
  const [activeTab, setActiveTab] = useState('ricette');

  return (
    <div>
      <RicettaAuthStatus />
      
      {/* Tabs principali */}
      <Card>
        <CNav variant="tabs" className="mb-3">
          <CNavItem>
            <CNavLink 
              active={activeTab === 'ricette'}
              onClick={() => setActiveTab('ricette')}
              style={{ cursor: 'pointer' }}
            >
              📋 Ricette Elettroniche
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink 
              active={activeTab === 'protocolli'}
              onClick={() => setActiveTab('protocolli')}
              style={{ cursor: 'pointer' }}
            >
              ⚙️ Gestione Protocolli
            </CNavLink>
          </CNavItem>
        </CNav>

        <CTabContent>
          <CTabPane visible={activeTab === 'ricette'}>
            {/* Switch modalità */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">
                {modalitaAvanzata ? '🤖 Modalità Protocolli Intelligenti' : '📝 Modalità Compilazione Libera'}
              </h5>
              <CButtonGroup role="group">
                <CButton 
                  color={modalitaAvanzata ? "primary" : "outline-primary"}
                  onClick={() => setModalitaAvanzata(true)}
                  size="sm"
                >
                  🤖 Avanzata
                </CButton>
                <CButton 
                  color={!modalitaAvanzata ? "primary" : "outline-primary"}
                  onClick={() => setModalitaAvanzata(false)}
                  size="sm"
                >
                  📝 Libera
                </CButton>
              </CButtonGroup>
            </div>
            
            {modalitaAvanzata ? (
              <RicettaAvanzata datiMedico={datiMedico} />
            ) : (
              <RicettaElettronica datiMedico={datiMedico} />
            )}
          </CTabPane>

          <CTabPane visible={activeTab === 'protocolli'}>
            <GestioneProtocolli />
          </CTabPane>
        </CTabContent>
      </Card>
    </div>
  )
};

export default RicettaElettronicaPage; 