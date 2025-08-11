/**
 * Test del sistema di classificazione STUDIO con i dati reali di ZZZZZP
 */

// Simulazione dei dati ZZZZZP trovati nel database
const speseZZZZZP = [
  {
    descrizione: "CORRISPETTIVO PER SUBLOCAZIONE PERIODO GIUGNO  PER IMMOBILE SITO IN VIA BUO",
    importo: 700.00,
    codice_fornitore: "ZZZZZP",
    nome_fornitore: "DELTA TRE ELABORAZIONI SNC"
  },
  {
    descrizione: "TeamSystem / Gestione Studio",
    importo: 0.00,
    codice_fornitore: "ZZZZZP",
    nome_fornitore: "DELTA TRE ELABORAZIONI SNC"
  },
  {
    descrizione: "Elaborazione buste paga mensili dipendenti",
    importo: 150.00,
    codice_fornitore: "ZZZZZP",
    nome_fornitore: "DELTA TRE ELABORAZIONI SNC"
  },
  {
    descrizione: "Tenuta contabilità ordinaria periodo marzo",
    importo: 250.00,
    codice_fornitore: "ZZZZZP", 
    nome_fornitore: "DELTA TRE ELABORAZIONI SNC"
  },
  {
    descrizione: "Dichiarazione IVA trimestrale",
    importo: 80.00,
    codice_fornitore: "ZZZZZP",
    nome_fornitore: "DELTA TRE ELABORAZIONI SNC"
  },
  {
    descrizione: "Consulenza fiscale su detrazioni",
    importo: 120.00,
    codice_fornitore: "ZZZZZP",
    nome_fornitore: "DELTA TRE ELABORAZIONI SNC"
  },
  {
    descrizione: "Adempimenti contributivi INPS/INAIL",
    importo: 90.00,
    codice_fornitore: "ZZZZZP",
    nome_fornitore: "DELTA TRE ELABORAZIONI SNC"
  }
];

// Importa il modulo di classificazione (simulato)
const StudioSottoconto = {
  GESTIONE_CONTABILE: 'GESTIONE_CONTABILE',
  GESTIONE_DIPENDENTI: 'GESTIONE_DIPENDENTI', 
  SPESE_GENERALI: 'SPESE_GENERALI'
};

const STUDIO_SOTTOCONTI_LABELS = {
  [StudioSottoconto.GESTIONE_CONTABILE]: 'Gestione Contabile',
  [StudioSottoconto.GESTIONE_DIPENDENTI]: 'Gestione Dipendenti',
  [StudioSottoconto.SPESE_GENERALI]: 'Spese Generali'
};

// Funzione di classificazione semplificata per il test
function classificaSpesaStudio(spesa) {
  const descrizione = spesa.descrizione.toLowerCase();
  
  // Gestione Contabile
  if (descrizione.includes('contabilità') || 
      descrizione.includes('dichiarazione') || 
      descrizione.includes('fiscale') || 
      descrizione.includes('iva')) {
    return {
      sottoconto: StudioSottoconto.GESTIONE_CONTABILE,
      sottoconto_nome: STUDIO_SOTTOCONTI_LABELS[StudioSottoconto.GESTIONE_CONTABILE],
      confidence: 0.9,
      motivo: 'Keywords contabili/fiscali rilevate'
    };
  }
  
  // Gestione Dipendenti
  if (descrizione.includes('buste paga') || 
      descrizione.includes('contributivi') || 
      descrizione.includes('inps') || 
      descrizione.includes('inail') ||
      descrizione.includes('dipendenti')) {
    return {
      sottoconto: StudioSottoconto.GESTIONE_DIPENDENTI,
      sottoconto_nome: STUDIO_SOTTOCONTI_LABELS[StudioSottoconto.GESTIONE_DIPENDENTI],
      confidence: 0.95,
      motivo: 'Keywords gestione dipendenti rilevate'
    };
  }
  
  // Spese Generali
  return {
    sottoconto: StudioSottoconto.SPESE_GENERALI,
    sottoconto_nome: STUDIO_SOTTOCONTI_LABELS[StudioSottoconto.SPESE_GENERALI],
    confidence: 0.8,
    motivo: 'Classificata come spesa generale'
  };
}

// Test delle classificazioni
console.log('=== TEST CLASSIFICAZIONE STUDIO ZZZZZP ===\n');

speseZZZZZP.forEach((spesa, index) => {
  const risultato = classificaSpesaStudio(spesa);
  
  console.log(`SPESA ${index + 1}:`);
  console.log(`  Descrizione: ${spesa.descrizione}`);
  console.log(`  Importo: €${spesa.importo}`);
  console.log(`  → CLASSIFICAZIONE: ${risultato.sottoconto_nome}`);
  console.log(`  → Confidence: ${(risultato.confidence * 100).toFixed(0)}%`);
  console.log(`  → Motivo: ${risultato.motivo}`);
  console.log('');
});

// Statistiche
const classificazioni = speseZZZZZP.map(s => classificaSpesaStudio(s));
const stats = classificazioni.reduce((acc, cls) => {
  acc[cls.sottoconto] = (acc[cls.sottoconto] || 0) + 1;
  return acc;
}, {});

console.log('=== STATISTICHE CLASSIFICAZIONE ===');
console.log(`Totale spese analizzate: ${speseZZZZZP.length}`);
console.log('\nDistribuzione per sottoconto:');
Object.entries(stats).forEach(([sottoconto, count]) => {
  const label = STUDIO_SOTTOCONTI_LABELS[sottoconto];
  const percentuale = ((count / speseZZZZZP.length) * 100).toFixed(1);
  console.log(`  ${label}: ${count} spese (${percentuale}%)`);
});

const confidenceMedia = classificazioni.reduce((sum, cls) => sum + cls.confidence, 0) / classificazioni.length;
console.log(`\nConfidence media: ${(confidenceMedia * 100).toFixed(1)}%`);

// Esempio di struttura finale
console.log('\n=== ESEMPIO STRUTTURA CLASSIFICAZIONE FINALE ===');
console.log('CONTO: STUDIO');
console.log('BRANCA: SERVIZI MISTI (classificazione fornitore)');
console.log('SOTTOCONTI: (assegnazione automatica per ogni spesa)');
speseZZZZZP.forEach((spesa, index) => {
  const risultato = classificaSpesaStudio(spesa);
  console.log(`  Spesa ${index + 1}: €${spesa.importo} → ${risultato.sottoconto_nome}`);
});