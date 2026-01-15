export interface SpesaFornitore {
  id: string;
  codice_fornitore: string;
  nome_fornitore?: string;
  descrizione: string;
  costo_netto: number;
  costo_iva: number;
  data_spesa: string | null;
  data_registrazione: string;
  numero_documento: string;
  note: string;
  categoria: number;
  categoria_automatica?: string;
  categoria_confidence?: number;
  importo_1: number;
  importo_2: number;
  aliquota_iva_1: number;
  aliquota_iva_2: number;
  rate: string;
}

export interface FiltriSpese {
  anno: number;
  mese?: number;
  data_inizio?: string;
  data_fine?: string;
  codice_fornitore?: string;
  numero_documento?: string;
  fattura_id?: string;
  conto_id?: string | number;
  branca_id?: string | number;
  sottoconto_id?: string | number;
  limit?: number;
  page?: number;
}

export interface RiepilogoMese {
  mese: number;
  nome_mese: string;
  totale: number;
  count: number;
}

export interface RiepilogoCategoria {
  categoria: number;
  totale: number;
  count: number;
}

export interface TopFornitore {
  codice_fornitore: string;
  totale: number;
  count: number;
}

export interface RiepilogoSpese {
  anno: number;
  totale_anno: number;
  per_mese: RiepilogoMese[];
  per_categoria: RiepilogoCategoria[];
  top_fornitori: TopFornitore[];
}

export interface SpeseFornitioriResponse {
  success: boolean;
  data: SpesaFornitore[];
  total: number;
  total_before_limit: number;
  filters_applied: FiltriSpese;
}

export interface RiepilogoSpeseFornitioriResponse {
  success: boolean;
  riepilogo: RiepilogoSpese;
}

export interface DettaglioSpesaFornitore {
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

export interface DettagliSpesaResponse {
  success: boolean;
  data: DettaglioSpesaFornitore[];
  fattura_id: string;
  total_righe: number;
}

export interface ArticoloRicerca {
  codice_articolo: string;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
}

export interface FatturaRicerca {
  id: string;
  numero_documento: string;
  codice_fornitore: string;
  nome_fornitore?: string;
  descrizione: string;
  data_spesa: string | null;
  costo_totale: number;
}

export interface RisultatoRicercaArticolo {
  articolo: ArticoloRicerca;
  fattura: FatturaRicerca | null;
}

export interface RicercaArticoliResponse {
  success: boolean;
  data: RisultatoRicercaArticolo[];
  query: string;
  total_found: number;
}

export interface RiepilogoFornitore {
  id: string;
  nome: string;
  codice_fornitore?: string;
  importo_netto: number;
  importo_iva: number;
  importo_totale: number;
  numero_fatture: number;
}

export interface BrancaProduzione {
  branca: string;
  importo: number;
  percentuale: number;
}

export interface ProduzioneOperatore {
  operatore: string;
  totale_periodo: number;
  dettaglio_branche: BrancaProduzione[];
}

export interface AnalisiProduzioneResponse {
  success: boolean;
  data: ProduzioneOperatore[];
  message?: string;
}

export interface RiepilogoSpeseFornitoriAnnoResponse {
  success: boolean;
  data: RiepilogoFornitore[];
  meta: {
    year: number;
    grand_total: number;
    count: number;
  };
  message?: string;
}

export interface FornitoreAttivo {
  id: string;
  nome: string;
}

export interface ActiveSuppliersResponse {
  success: boolean;
  data: FornitoreAttivo[];
  message: string;
}