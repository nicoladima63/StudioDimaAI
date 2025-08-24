// Tipi di costo
export type TipoDiCosto = 1 | 2 | 3;
export const TipoDiCosto = {
  DIRETTO: 1 as const,
  INDIRETTO: 2 as const,
  NON_DEDUCIBILE: 3 as const
} as const;

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
  categoria_conto?: string;  // Codice conto contabile (legacy)
  sottoconto?: string;       // Codice sottoconto (legacy)
  // Nuovi campi numerici
  contoid?: number;
  brancaid?: number;
  sottocontoid?: number;
  fornitoreid?: number;
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
  categoria_conto?: string;  // Codice conto contabile (legacy)
  sottoconto?: string;       // Codice sottoconto (legacy)
  // Nuovi campi numerici
  contoid?: number;
  brancaid?: number;
  sottocontoid?: number;
  note?: string;
}

// Interface per la richiesta di classificazione completa (nuovo sistema)
export interface ClassificazioneCompletaRequest {
  tipo_di_costo: TipoDiCosto;
  contoid: number;
  brancaid: number;
  sottocontoid: number;
  note?: string;
  fornitore_nome?: string;
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