/**
 * File di test per la categorizzazione automatica
 * Basato sui dati reali analizzati dal database
 */

import type { SpesaFornitore } from '../types';
import { categorizzaSpesaFornitore, getStatisticheCategorizzazione, CategoriaSpesa } from './autoCategorization';

// Dati di test basati sui pattern reali identificati
export const TEST_SPESE: SpesaFornitore[] = [
  // Energia Elettrica
  {
    id: 'TEST001',
    codice_fornitore: 'ZZZZZL',
    nome_fornitore: 'Enel Energia SpA',
    descrizione: 'Fattura per la fornitura di energia elettrica consumo periodo',
    numero_documento: '003011504823',
    costo_netto: 150.00,
    costo_iva: 180.00,
    data_spesa: '2024-01-15',
    data_registrazione: '2024-01-16',
    note: '',
    categoria: 0,
    importo_1: 150.00,
    importo_2: 30.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },
  {
    id: 'TEST002',
    codice_fornitore: 'ZZZZVC',
    nome_fornitore: 'EMPIRE POWERGAS & MOBILITY S.R.L.',
    descrizione: 'Fattura per la fornitura di energia elettrica cons',
    numero_documento: '003027254458',
    costo_netto: 200.00,
    costo_iva: 244.00,
    data_spesa: '2024-02-10',
    data_registrazione: '2024-02-11',
    note: '',
    categoria: 0,
    importo_1: 200.00,
    importo_2: 44.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Telecomunicazioni
  {
    id: 'TEST003',
    codice_fornitore: 'ZZZZZM',
    nome_fornitore: 'Wind Tre S.p.A.',
    descrizione: 'Wind Tre S.p.A. con Socio Unico - Direzione e Coor',
    numero_documento: 'R00003327',
    costo_netto: 80.00,
    costo_iva: 97.60,
    data_spesa: '2024-01-20',
    data_registrazione: '2024-01-21',
    note: '',
    categoria: 0,
    importo_1: 80.00,
    importo_2: 17.60,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },
  {
    id: 'TEST004',
    codice_fornitore: 'ZZZZZI',
    nome_fornitore: 'VODAFONE ITALIA S.p.A.',
    descrizione: 'Decisione Commerciale',
    numero_documento: 'R190024151',
    costo_netto: 45.50,
    costo_iva: 55.51,
    data_spesa: '2024-02-05',
    data_registrazione: '2024-02-06',
    note: '',
    categoria: 0,
    importo_1: 45.50,
    importo_2: 10.01,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },
  {
    id: 'TEST005',
    codice_fornitore: 'ZZZZZB',
    nome_fornitore: 'TIM S.p.A.',
    descrizione: 'Canone telefonico mensile',
    numero_documento: 'M024295082',
    costo_netto: 35.00,
    costo_iva: 42.70,
    data_spesa: '2024-01-30',
    data_registrazione: '2024-01-31',
    note: '',
    categoria: 0,
    importo_1: 35.00,
    importo_2: 7.70,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Acqua/Utenze
  {
    id: 'TEST006',
    codice_fornitore: 'ZZZZZG',
    nome_fornitore: 'Publiacqua S.p.A.',
    descrizione: 'Servizio idrico integrato',
    numero_documento: 'IT21-AEUI-1111540',
    costo_netto: 120.00,
    costo_iva: 132.00,
    data_spesa: '2024-01-25',
    data_registrazione: '2024-01-26',
    note: '',
    categoria: 0,
    importo_1: 120.00,
    importo_2: 12.00,
    aliquota_iva_1: 10,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Materiali Dentali
  {
    id: 'TEST007',
    codice_fornitore: 'ZZZZZO',
    nome_fornitore: 'Dentsply Sirona Italia Srl',
    descrizione: 'Materiali dentali vari',
    numero_documento: 'FPR 138/19',
    costo_netto: 850.00,
    costo_iva: 1037.00,
    data_spesa: '2024-02-12',
    data_registrazione: '2024-02-13',
    note: '',
    categoria: 1,
    importo_1: 850.00,
    importo_2: 187.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },
  {
    id: 'TEST008',
    codice_fornitore: 'ZZZZZF',
    nome_fornitore: 'HENRY SCHEIN KRUGG S.R.L',
    descrizione: 'CONTRIBUTO CONAI ASSOLTO OVE DOVUTO',
    numero_documento: 'FPR 240/19',
    costo_netto: 450.00,
    costo_iva: 549.00,
    data_spesa: '2024-01-18',
    data_registrazione: '2024-01-19',
    note: '',
    categoria: 1,
    importo_1: 450.00,
    importo_2: 99.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },
  {
    id: 'TEST009',
    codice_fornitore: 'ZZZZYN',
    nome_fornitore: 'FUTURIMPLANT1 SRL UNIPERSONALE',
    descrizione: 'Impianti dentali',
    numero_documento: 'FPR 055/20',
    costo_netto: 1200.00,
    costo_iva: 1464.00,
    data_spesa: '2024-02-20',
    data_registrazione: '2024-02-21',
    note: '',
    categoria: 1,
    importo_1: 1200.00,
    importo_2: 264.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Leasing Finanziario
  {
    id: 'TEST010',
    codice_fornitore: 'ZZZZZN',
    nome_fornitore: 'BNP PARIBAS LEASING SOLUTIONS SPA',
    descrizione: 'Contratto di: Locazione Finanziaria Cliente: 10195',
    numero_documento: '000/110/2020',
    costo_netto: 800.00,
    costo_iva: 976.00,
    data_spesa: '2024-01-01',
    data_registrazione: '2024-01-02',
    note: '',
    categoria: 0,
    importo_1: 800.00,
    importo_2: 176.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },
  {
    id: 'TEST011',
    codice_fornitore: 'ZZZZZK',
    nome_fornitore: 'BNP PARIBAS LEASE GROUP SA',
    descrizione: 'Contratto di: Locazione Finanziaria Cliente: 11038',
    numero_documento: '000/134/2023',
    costo_netto: 750.00,
    costo_iva: 915.00,
    data_spesa: '2024-02-01',
    data_registrazione: '2024-02-02',
    note: '',
    categoria: 0,
    importo_1: 750.00,
    importo_2: 165.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Internet/Hosting
  {
    id: 'TEST012',
    codice_fornitore: 'ZZZZZE',
    nome_fornitore: 'Aruba S.p.A.',
    descrizione: 'Servizi hosting e dominio',
    numero_documento: 'A7A03164',
    costo_netto: 120.00,
    costo_iva: 146.40,
    data_spesa: '2024-01-05',
    data_registrazione: '2024-01-06',
    note: '',
    categoria: 0,
    importo_1: 120.00,
    importo_2: 26.40,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Servizi Bancari
  {
    id: 'TEST013',
    codice_fornitore: 'ZZZZYP',
    nome_fornitore: 'NEXI PAYMENTS S.p.A.',
    descrizione: 'Commissioni POS e servizi di pagamento',
    numero_documento: 'C1AV10002708',
    costo_netto: 85.00,
    costo_iva: 103.70,
    data_spesa: '2024-01-12',
    data_registrazione: '2024-01-13',
    note: '',
    categoria: 0,
    importo_1: 85.00,
    importo_2: 18.70,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Formazione
  {
    id: 'TEST014',
    codice_fornitore: 'ZZZZQJ',
    nome_fornitore: 'Health Coaching Academy Co. UK Ltd',
    descrizione: 'CORSO "10 COSE DA SAPERE PER UNA SEGRETERIA ODONTO"',
    numero_documento: 'GDA03923',
    costo_netto: 350.00,
    costo_iva: 427.00,
    data_spesa: '2024-02-08',
    data_registrazione: '2024-02-09',
    note: '',
    categoria: 3,
    importo_1: 350.00,
    importo_2: 77.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Consulenze
  {
    id: 'TEST015',
    codice_fornitore: 'ZZZZQI',
    nome_fornitore: 'OFFICINA srls',
    descrizione: 'CONSULENZA ABBIGLIAMENTO MEDICALE',
    numero_documento: 'ZZ09053203',
    costo_netto: 500.00,
    costo_iva: 610.00,
    data_spesa: '2024-01-28',
    data_registrazione: '2024-01-29',
    note: '',
    categoria: 3,
    importo_1: 500.00,
    importo_2: 110.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Farmaceutici
  {
    id: 'TEST016',
    codice_fornitore: 'ZZZZRH',
    nome_fornitore: 'Biaggini Medical Devices s.r.l.',
    descrizione: 'Dispositivi medici e farmaceutici',
    numero_documento: 'BQE03768',
    costo_netto: 280.00,
    costo_iva: 341.60,
    data_spesa: '2024-02-15',
    data_registrazione: '2024-02-16',
    note: '',
    categoria: 1,
    importo_1: 280.00,
    importo_2: 61.60,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Laboratori Odontotecnici
  {
    id: 'TEST017',
    codice_fornitore: 'ZZZZXC',
    nome_fornitore: 'Lab.Odontotecnico ROBERTO MORELLI',
    descrizione: 'Protesi e lavori odontotecnici',
    numero_documento: 'V3-106831',
    costo_netto: 650.00,
    costo_iva: 793.00,
    data_spesa: '2024-02-25',
    data_registrazione: '2024-02-26',
    note: '',
    categoria: 2,
    importo_1: 650.00,
    importo_2: 143.00,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  },

  // Altro/Non categorizzato
  {
    id: 'TEST018',
    codice_fornitore: 'ZZZZQP',
    nome_fornitore: 'Straumann Italia Srl',
    descrizione: 'Materiali vari per implantologia',
    numero_documento: 'AL00510041',
    costo_netto: 920.00,
    costo_iva: 1122.40,
    data_spesa: '2024-02-18',
    data_registrazione: '2024-02-19',
    note: '',
    categoria: 1,
    importo_1: 920.00,
    importo_2: 202.40,
    aliquota_iva_1: 22,
    aliquota_iva_2: 0,
    rate: ''
  }
];

/**
 * Funzione per testare il sistema di categorizzazione
 */
export function testCategorizzazione(): void {
  console.log('=== TEST SISTEMA DI CATEGORIZZAZIONE ===\n');
  
  // Test singole spese
  console.log('1. TEST CATEGORIZZAZIONE SINGOLE SPESE:\n');
  TEST_SPESE.forEach((spesa, index) => {
    const risultato = categorizzaSpesaFornitore(spesa);
    console.log(`${(index + 1).toString().padStart(2, ' ')}. ${spesa.nome_fornitore}`);
    console.log(`    Categoria: ${risultato.categoria}`);
    console.log(`    Confidence: ${Math.round(risultato.confidence * 100)}%`);
    console.log(`    Motivo: ${risultato.motivo}`);
    console.log('');
  });
  
  // Test statistiche
  console.log('2. STATISTICHE GENERALI:\n');
  const statistiche = getStatisticheCategorizzazione(TEST_SPESE);
  console.log(`Totale spese: ${statistiche.totaleSpese}`);
  console.log(`Spese riconosciute: ${statistiche.speseRiconosciute}`);
  console.log(`Tasso riconoscimento: ${statistiche.percentualeRiconoscimento}%\n`);
  
  // Dettagli per categoria
  console.log('3. DETTAGLI PER CATEGORIA:\n');
  statistiche.dettagliCategorie.forEach(cat => {
    console.log(`${cat.label}:`);
    console.log(`  - ${cat.count} spese (${cat.percentuale}%)`);
    console.log(`  - Confidence media: ${cat.confidenceMedia}`);
    console.log('');
  });
  
  // Test pattern specifici
  console.log('4. TEST PATTERN SPECIFICI:\n');
  
  // Pattern energia
  const speseEnergia = TEST_SPESE.filter(s => 
    s.nome_fornitore?.toLowerCase().includes('enel') || 
    s.nome_fornitore?.toLowerCase().includes('empire')
  );
  console.log(`Pattern Energia (${speseEnergia.length} spese):`);
  speseEnergia.forEach(spesa => {
    const cat = categorizzaSpesaFornitore(spesa);
    console.log(`  ${spesa.nome_fornitore} -> ${cat.categoria} (${Math.round(cat.confidence * 100)}%)`);
  });
  console.log('');
  
  // Pattern telecomunicazioni
  const speseTelco = TEST_SPESE.filter(s =>
    s.nome_fornitore?.toLowerCase().includes('wind') ||
    s.nome_fornitore?.toLowerCase().includes('vodafone') ||
    s.nome_fornitore?.toLowerCase().includes('tim')
  );
  console.log(`Pattern Telecomunicazioni (${speseTelco.length} spese):`);
  speseTelco.forEach(spesa => {
    const cat = categorizzaSpesaFornitore(spesa);
    console.log(`  ${spesa.nome_fornitore} -> ${cat.categoria} (${Math.round(cat.confidence * 100)}%)`);
  });
  console.log('');
  
  // Pattern materiali dentali
  const speseDentali = TEST_SPESE.filter(s =>
    s.nome_fornitore?.toLowerCase().includes('dental') ||
    s.nome_fornitore?.toLowerCase().includes('dentsply') ||
    s.nome_fornitore?.toLowerCase().includes('schein') ||
    s.nome_fornitore?.toLowerCase().includes('implant')
  );
  console.log(`Pattern Materiali Dentali (${speseDentali.length} spese):`);
  speseDentali.forEach(spesa => {
    const cat = categorizzaSpesaFornitore(spesa);
    console.log(`  ${spesa.nome_fornitore} -> ${cat.categoria} (${Math.round(cat.confidence * 100)}%)`);
  });
  console.log('');
}

/**
 * Funzione per generare report di categorizzazione
 */
export function generaReportCategorizzazione(): string {
  const statistiche = getStatisticheCategorizzazione(TEST_SPESE);
  
  let report = '# REPORT CATEGORIZZAZIONE AUTOMATICA\n\n';
  report += `**Data Report:** ${new Date().toLocaleDateString('it-IT')}\n\n`;
  
  report += '## Riepilogo Generale\n\n';
  report += `- **Totale spese analizzate:** ${statistiche.totaleSpese}\n`;
  report += `- **Spese riconosciute:** ${statistiche.speseRiconosciute}\n`;
  report += `- **Tasso di riconoscimento:** ${statistiche.percentualeRiconoscimento}%\n\n`;
  
  report += '## Distribuzione per Categoria\n\n';
  statistiche.dettagliCategorie.forEach(cat => {
    report += `### ${cat.label}\n`;
    report += `- **Spese:** ${cat.count} (${cat.percentuale}%)\n`;
    report += `- **Confidence media:** ${cat.confidenceMedia}\n\n`;
  });
  
  report += '## Fornitori per Categoria\n\n';
  const categorieUniche = Array.from(new Set(
    TEST_SPESE.map(s => categorizzaSpesaFornitore(s).categoria)
  ));
  
  categorieUniche.forEach(categoria => {
    const speseCat = TEST_SPESE.filter(s => 
      categorizzaSpesaFornitore(s).categoria === categoria
    );
    
    if (speseCat.length > 0) {
      report += `### ${categoria}\n`;
      speseCat.forEach(spesa => {
        const cat = categorizzaSpesaFornitore(spesa);
        report += `- **${spesa.nome_fornitore}** (${Math.round(cat.confidence * 100)}%): ${cat.motivo}\n`;
      });
      report += '\n';
    }
  });
  
  return report;
}

// Esporta anche le categorie per riferimento
export { CategoriaSpesa };