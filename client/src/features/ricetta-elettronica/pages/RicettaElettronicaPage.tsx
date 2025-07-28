import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import RicettaAuthStatus from '../components/RicettaAuthStatus';
import RicettePaziente from '../components/RicettePaziente';
import RicettaAvanzata from '../components/RicettaAvanzata';
import RicetteTSPaziente from '../components/RicetteTSPaziente';
import AutoComplete from '@/components/common/AutoComplete';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane, CRow, CCol, CCard, CCardBody } from '@coreui/react';
import { getPazientiAll } from '@/api/services/pazienti.service';
import { usePazientiStore } from '@/store/pazienti.store';
import type { PazienteCompleto } from '@/lib/types';

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
  const [activeTab, setActiveTab] = useState('compila');
  
  // Stato paziente globale
  const allPazienti = usePazientiStore(state => state.pazienti);
  const setPazienti = usePazientiStore(state => state.setPazienti);
  const [pazienteSelezionato, setPazienteSelezionato] = useState<PazienteCompleto | null>(null);
  const [search, setSearch] = useState('');

  // Carica pazienti all'avvio
  useEffect(() => {
    const loadPazienti = async () => {
      if (allPazienti.length === 0) {
        try {
          const res = await getPazientiAll();
          if (res.success) setPazienti(res.data);
        } catch (error) {
          console.error('Errore caricamento pazienti:', error);
        }
      }
    };
    loadPazienti();
  }, [allPazienti.length, setPazienti]);

  // Funzione di ricerca pazienti
  const fetchPazienti = async (q: string): Promise<PazienteCompleto[]> => {
    const ql = q.toLowerCase();
    const pazienti = usePazientiStore.getState().pazienti;
    const result = pazienti.filter(p =>
      (p.DB_PANOME && p.DB_PANOME.toLowerCase().includes(ql)) ||
      (p.DB_PACODFI && p.DB_PACODFI.toLowerCase().includes(ql))
    );
    return result;
  };

  return (
    <div>
      <Card 
        title="Ricette Elettroniche"
        headerAction={<RicettaAuthStatus />}
      >
        {/* Selezione Paziente Globale */}
        <CCard className="mb-4">
          <CCardBody>
            <CRow className="align-items-center">
              <CCol md={8}>
                <AutoComplete<PazienteCompleto>
                  value={pazienteSelezionato ? pazienteSelezionato.DB_PANOME : search}
                  onChange={setSearch}
                  onSelect={(paziente: PazienteCompleto) => {
                    setPazienteSelezionato(paziente);
                    setSearch(paziente.DB_PANOME);
                  }}
                  fetchSuggestions={fetchPazienti}
                  getOptionLabel={(p: PazienteCompleto) => `${p.DB_PANOME} (${p.DB_PACODFI})`}
                  placeholder="Digita nome paziente..."
                />
              </CCol>
              <CCol md={4}>
                {pazienteSelezionato && (
                  <div className="text-center">
                    <strong className="text-success">
                      📋 {pazienteSelezionato.DB_PANOME}
                    </strong>
                    <br />
                    <small className="text-muted">CF: {pazienteSelezionato.DB_PACODFI}</small>
                  </div>
                )}
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {/* Navigation Tabs */}
        <CNav variant="tabs" role="tablist">
          <CNavItem>
            <CNavLink
              active={activeTab === 'compila'}
              onClick={() => setActiveTab('compila')}
              role="tab"
            >
              📝 Compila Ricetta
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'sistema-ts'}
              onClick={() => setActiveTab('sistema-ts')}
              role="tab"
            >
              🌐 Ricette Sistema TS
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'database'}
              onClick={() => setActiveTab('database')}
              role="tab"
            >
              💾 Ricette Database
            </CNavLink>
          </CNavItem>
        </CNav>

        {/* Tab Content */}
        <CTabContent className="mt-4">
          <CTabPane visible={activeTab === 'compila'} role="tabpanel">
            <RicettaAvanzata 
              datiMedico={datiMedico} 
              pazienteSelezionato={pazienteSelezionato}
            />
          </CTabPane>

          <CTabPane visible={activeTab === 'sistema-ts'} role="tabpanel">
            <RicetteTSPaziente 
              pazienteSelezionato={pazienteSelezionato}
            />
          </CTabPane>

          <CTabPane visible={activeTab === 'database'} role="tabpanel">
            <RicettePaziente 
              cfPazienteIniziale={pazienteSelezionato?.DB_PACODFI?.trim() || ''}
            />
          </CTabPane>
        </CTabContent>
      </Card>
    </div>
  )
};

export default RicettaElettronicaPage; 