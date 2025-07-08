import React, { useState, useEffect } from 'react';
import { CRow, CCol, CButton, CSpinner } from '@coreui/react';
import { cilPlus } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { DashboardCard } from '@/components/ui';

import RicettaElettronica from './RicettaElettronica';
import { getPazientiList } from '@/api/apiClient';

// Interfacce TypeScript
interface DatiMedico {
  regione: string;
  regioneOrdine: string;
  ambito: string;
  specializzazione: string;
  iscrizione: string;
  indirizzo: string;
  telefono: string;
  cap: string;
  citta: string;
  provincia: string;
}

interface Paziente {
  id: string;
  nome: string;
  cognome: string;
  codiceFiscale: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
}

// Simulazione dati medico letti da file (in futuro leggere da file JSON)
const datiMedico: DatiMedico = {
  regione: 'ORDINE DEI MEDICI',
  regioneOrdine: 'OdM - TOSCANA',
  ambito: 'K',
  specializzazione: 'odontoiatra',
  iscrizione: '591',
  indirizzo: 'via michelangelo Buonarroti, 15',
  telefono: '3464731192',
  cap: '51031',
  citta: 'Agliana',
  provincia: 'PT',
};

const RicettaElettronicaPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true)
  const [pazienti, setPazienti] = useState<Paziente[]>([]);

  useEffect(() => {
    getPazientiList()
      .then(pazientiRaw => {
        const pazientiArr = pazientiRaw.data;
        const pazienti = pazientiArr.map((p: { DB_CODE: string; DB_PANOME: string; DB_PACODFI: string; DB_PAINDIR: string; DB_PACAP: string; DB_PACITTA: string; DB_PAPROVI: string }) => ({
          id: p.DB_CODE,
          nome: p.DB_PANOME,
          cognome: '',
          codiceFiscale: p.DB_PACODFI,
          indirizzo: p.DB_PAINDIR,
          cap: p.DB_PACAP,
          citta: p.DB_PACITTA,
          provincia: p.DB_PAPROVI,
        }));
        setPazienti(pazienti);
        setLoading(false)

      })
      .catch(err => console.error("Errore caricamento pazienti:", err));
  }, []);

  return (
    <DashboardCard 
    title="Ricetta Elettronica dematrializzata" 
    headerAction={
      <CButton color="primary" size="sm">
        <CIcon icon={cilPlus} className="me-1" />
        Nuova
      </CButton>
    }
  >
        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
            <p>Caricamento dati in corso...</p>
          </div>
        ) : (             
           <RicettaElettronica pazienti={pazienti} datiMedico={datiMedico} />


            )}
    
    </DashboardCard>
  );
};

export default RicettaElettronicaPage; 