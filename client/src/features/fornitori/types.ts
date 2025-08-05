export interface Fornitore {
  id: string;
  nome: string;
  codice_fiscale: string;
  partita_iva: string;
  indirizzo: string;
  citta: string;
  provincia: string;
  cap: string;
  telefono: string;
  fax: string;
  cellulare: string;
  rata: string;
  banca: string;
  note: string;
  email: string;
  commessa: string;
  sito: string;
  codice_iva: string;
  codice_societa: string;
  nazione: string;
  prezzo_speciale: number;
  tipo_fornitore: number;
  ritenuta_sostituto: string;
  news_speciale: string;
  contatto: string;
  ufficio: string;
  nodo_escluso: string;
  pagamento: string;
  suffisso: string;
  email_2: string;
  iban: string;
  denominazione: string;
  indirizzo_diverso: string;
  citta_diversa: string;
  cap_diverso: string;
  provincia_diversa: string;
  banca_2: string;
  pagamento_alternativo: string;
  iva_deducibile: number;
  commissione: number;
  codice_destinazione: string;
  note_destinazione: string;
  regime: number;
  iva_contribuente: string;
  totale_dovuto: number;
  categoria: number;
}

export interface FatturaFornitore {
  id: string;
  codice_fornitore: string;
  descrizione: string;
  costo_netto: number;
  costo_iva: number;
  data_spesa: string;
  data_registrazione: string;
  numero_documento: string;
  note: string;
  categoria: number;
}

export interface DettaglioFattura {
  codice_fattura: string;
  codice_articolo: string;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  sconto: number;
  ritenuta: string;
  aliquota_iva: number;
  codice_iva: string;
  totale_riga: number;
}

export interface FornitoriResponse {
  success?: boolean; // Opzionale perché a volte non arriva
  data: Fornitore[];
  count: number;
}

export interface FornitoreResponse {
  success: boolean;
  data: Fornitore;
}

// Enum per i tipi di costo
export enum TipoDiCosto {
  DIRETTO = 1,
  INDIRETTO = 2,
  NON_DEDUCIBILE = 3
}

// Labels per i tipi di costo
export const TipoDiCostoLabels = {
  [TipoDiCosto.DIRETTO]: 'Diretto',
  [TipoDiCosto.INDIRETTO]: 'Indiretto', 
  [TipoDiCosto.NON_DEDUCIBILE]: 'Non Deducibile'
} as const;

// Interface per la classificazione
export interface ClassificazioneCosto {
  id: number;
  codice_riferimento: string;
  tipo_entita: 'fornitore' | 'spesa';
  tipo_di_costo: TipoDiCosto;
  categoria?: number;
  categoria_conto?: string;  // Codice conto contabile
  note?: string;
  data_classificazione: string;
  data_modifica: string;
}

// Interface per la risposta API classificazione
export interface ClassificazioneResponse {
  success: boolean;
  data?: ClassificazioneCosto;
  message?: string;
  error?: string;
}

// Interface per la richiesta di classificazione
export interface ClassificazioneRequest {
  tipo_di_costo: TipoDiCosto;
  categoria?: number;
  categoria_conto?: string;  // Codice conto contabile
  note?: string;
}

// Interface per le categorie di spesa da CONTI.DBF
export interface CategoriaSpesa {
  codice_conto: string;
  descrizione: string;
  tipo: string;
}

// Interface per le statistiche classificazioni
export interface StatisticheClassificazioni {
  fornitori: {
    diretti?: number;
    indiretti?: number;
    non_deducibili?: number;
  };
  spese: {
    diretti?: number;
    indiretti?: number;
    non_deducibili?: number;
  };
}