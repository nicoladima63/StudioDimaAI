import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CRow,
  CCol,
} from '@coreui/react';
import PageLayout from '@/components/layout/PageLayout';
import RicettaAuthStatus from '../components/RicettaAuthStatus';
import RicettePaziente from '../components/RicettePaziente';
import RicettaAvanzata from '../components/RicettaAvanzata';
//import RicetteTSPaziente from '../components/RicetteTSPaziente';
import PazientiSelect from '@/components/selects/PazientiSelect';
import { usePazientiStore, type Paziente } from '@/store/pazienti.store';

// Dati reali del medico
const datiMedico = {
  regione: '090', // Toscana
  regioneOrdine: 'Firenze',
  ambito: 'Odontoiatria',
  specializzazione: 'F', // Odontoiatra
  iscrizione: '591',
  indirizzo: 'Via Michelangelo Buonarroti,15',
  telefono: '0574712060',
  cap: '51031',
  citta: 'Agliana',
  provincia: 'PT',
  asl: '109', // ASL Toscana Centro
  cfMedico: 'DMRNCL63S21D612I',
};

const RicettaElettronicaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('compila');
  const [pazienteSelezionato, setPazienteSelezionato] = useState<Paziente | null>(null);
  const { loadAllPazienti } = usePazientiStore();

  // Carica pazienti all'avvio
  useEffect(() => {
    loadAllPazienti();
  }, [loadAllPazienti]);


  return (
    <PageLayout>
      <PageLayout.Header title='Ricetta Elettronica' />
      <PageLayout.ContentHeader>
        <div className='row'>
          <div className='col-md-8'>
            <PazientiSelect
              value={pazienteSelezionato?.id || null}
              onChange={setPazienteSelezionato}
              placeholder='Digita nome paziente...'
              searchable={true}
              clearable={true}
            />
          </div>
          <div className='col-md-4 '>
            {pazienteSelezionato && (
              <div className='text-center'>
                <strong className='text-success'>📋 {pazienteSelezionato.nome}</strong>
                <br />
                <small className='text-muted'>CF: {pazienteSelezionato.codice_fiscale}</small>
              </div>
            )}
          </div>
        </div>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <CNav variant='tabs' role='tablist'>
          <CNavItem>
            <CNavLink
              active={activeTab === 'compila'}
              onClick={() => setActiveTab('compila')}
              role='tab'
            >
              📝 Compila Ricetta
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'sistema-ts'}
              onClick={() => setActiveTab('sistema-ts')}
              role='tab'
            >
              🌐 List Ricette TS
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'database'}
              onClick={() => setActiveTab('database')}
              role='tab'
            >
              💾 List Ricette DB
            </CNavLink>
          </CNavItem>
        </CNav>
        <CTabContent className='mt-4'>
          <CTabPane visible={activeTab === 'compila'} role='tabpanel'>
            <RicettaAvanzata 
            datiMedico={datiMedico} 
            pazienteSelezionato={pazienteSelezionato}
          />
          </CTabPane>

          <CTabPane visible={activeTab === 'sistema-ts'} role='tabpanel'>
            {/* <RicetteTSPaziente 
            pazienteSelezionato={pazienteSelezionato}
          /> */}
          </CTabPane>

          <CTabPane visible={activeTab === 'database'} role='tabpanel'>
            <RicettePaziente 
              cfPazienteIniziale={pazienteSelezionato?.codice_fiscale?.trim() || ''}
            />
          </CTabPane>
        </CTabContent>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default RicettaElettronicaPage;
