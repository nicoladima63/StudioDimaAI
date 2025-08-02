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

export interface FornitoriResponse {
  success?: boolean; // Opzionale perché a volte non arriva
  data: Fornitore[];
  count: number;
}

export interface FornitoreResponse {
  success: boolean;
  data: Fornitore;
}