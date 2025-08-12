import type { FatturaFornitore } from '../../../fornitori/services/fornitori.service';

export interface StatisticheLavoroCollaboratore {
  totale_fatturato: number;
  numero_fatture: number;
  media_fattura: number;
  totali_mensili: { mese: string; totale: number }[];
  ultimo_lavoro: string | null;
}

export function calcolaStatisticheLavoro(fatture: FatturaFornitore[]): StatisticheLavoroCollaboratore {
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
    const netto = fattura.costo_netto || 0;
    const iva = fattura.costo_iva || 0;
    return sum + netto + iva;
  }, 0);

  const numero_fatture = fatture.length;
  const media_fattura = numero_fatture > 0 ? totale_fatturato / numero_fatture : 0;

  // Raggruppa per mese
  const totaliPerMese = new Map<string, number>();
  
  fatture.forEach(fattura => {
    if (fattura.data_spesa) {
      const data = new Date(fattura.data_spesa);
      const meseAnno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      
      const netto = fattura.costo_netto || 0;
      const iva = fattura.costo_iva || 0;
      const totale = netto + iva;
      
      totaliPerMese.set(meseAnno, (totaliPerMese.get(meseAnno) || 0) + totale);
    }
  });

  // Converti in array e ordina per mese
  const totali_mensili = Array.from(totaliPerMese.entries())
    .map(([mese, totale]) => ({ mese, totale }))
    .sort((a, b) => a.mese.localeCompare(b.mese));

  // Trova ultimo lavoro
  let ultimo_lavoro: string | null = null;
  const dateSpesa = fatture
    .map(f => f.data_spesa)
    .filter(d => d)
    .sort((a, b) => b!.localeCompare(a!));
  
  if (dateSpesa.length > 0) {
    ultimo_lavoro = dateSpesa[0]!;
  }

  return {
    totale_fatturato: Math.round(totale_fatturato * 100) / 100,
    numero_fatture,
    media_fattura: Math.round(media_fattura * 100) / 100,
    totali_mensili,
    ultimo_lavoro
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(amount);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Mai';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}