import type { FatturaFornitore } from '../../../fornitori/services/fornitori.service';

export interface StatisticheSpeseFornitore {
  totale_fatturato: number;
  numero_fatture: number;
  media_fattura: number;
  totali_mensili: { mese: string; totale: number }[];
  ultimo_lavoro: string | null;
}

export function calcolaStatisticheSpese(fatture: FatturaFornitore[]): StatisticheSpeseFornitore {
  if (!fatture || fatture.length === 0) {
    return {
      totale_fatturato: 0,
      numero_fatture: 0,
      media_fattura: 0,
      totali_mensili: [],
      ultimo_lavoro: null
    };
  }

  // Calcola totale fatturato
  const totale_fatturato = fatture.reduce((sum, fattura) => {
    const importo = typeof fattura.importo === 'number' ? fattura.importo : parseFloat(fattura.importo) || 0;
    return sum + importo;
  }, 0);

  // Numero fatture
  const numero_fatture = fatture.length;

  // Media per fattura
  const media_fattura = numero_fatture > 0 ? totale_fatturato / numero_fatture : 0;

  // Raggruppa per mese
  const raggruppatoMese = new Map<string, number>();
  let ultimaData: Date | null = null;

  fatture.forEach(fattura => {
    const importo = typeof fattura.importo === 'number' ? fattura.importo : parseFloat(fattura.importo) || 0;
    
    // Data fattura
    const dataFattura = new Date(fattura.data_fattura);
    if (!ultimaData || dataFattura > ultimaData) {
      ultimaData = dataFattura;
    }

    // Raggruppa per mese/anno
    const meseAnno = `${dataFattura.getFullYear()}-${String(dataFattura.getMonth() + 1).padStart(2, '0')}`;
    const current = raggruppatoMese.get(meseAnno) || 0;
    raggruppatoMese.set(meseAnno, current + importo);
  });

  // Converti in array e ordina per data
  const totali_mensili = Array.from(raggruppatoMese.entries())
    .map(([mese, totale]) => ({
      mese,
      totale: Math.round(totale * 100) / 100 // Arrotonda a 2 decimali
    }))
    .sort((a, b) => a.mese.localeCompare(b.mese));

  return {
    totale_fatturato: Math.round(totale_fatturato * 100) / 100,
    numero_fatture,
    media_fattura: Math.round(media_fattura * 100) / 100,
    totali_mensili,
    ultimo_lavoro: ultimaData ? ultimaData.toISOString().split('T')[0] : null
  };
}

// Funzioni di utilità per formattazione
export function formatCurrency(value: number): string {
  if (value === 0) return '€ 0,00';
  
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    return 'N/A';
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('it-IT').format(value);
}