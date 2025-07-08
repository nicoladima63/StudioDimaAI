import React from 'react';
import Card from '@/components/ui/Card';
import RicettaElettronica from '../components/RicettaElettronica';

// Placeholder: dati fittizi per pazienti e medico
const pazienti = [
  { id: '1', nome: 'Mario', cognome: 'Rossi', codiceFiscale: 'RSSMRA80A01H501U' },
  { id: '2', nome: 'Giulia', cognome: 'Bianchi', codiceFiscale: 'BNCGLI85C41F205X' }
];

const datiMedico = {
  regione: 'Lazio',
  regioneOrdine: 'Roma',
  ambito: 'Odontoiatria',
  specializzazione: 'Odontoiatra',
  iscrizione: '12345',
  indirizzo: 'Via Roma 1',
  telefono: '0612345678',
  cap: '00100',
  citta: 'Roma',
  provincia: 'RM'
};

const RicettaElettronicaPage: React.FC = () => {
  return (
    <Card title="Ricetta Elettronica ">
      <RicettaElettronica pazienti={pazienti} datiMedico={datiMedico} />;
    </Card>
  )
};

export default RicettaElettronicaPage; 