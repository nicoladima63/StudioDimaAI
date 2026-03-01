export interface KpiCurrent {
  anno: number;
  mese_corrente: number;
  produzione_ytd: number;
  incasso_ytd: number;
  ore_cliniche_ytd: number;
  costi_totali_ytd: number;
  margine_ytd: number;
  ricavo_medio_ora: number;
  costo_orario_totale: number;
  margine_pct: number;
  break_even_mensile: number;
  produzione_media_mensile: number;
  num_fatture_ytd: number;
  num_appuntamenti_ytd: number;
  mesi_con_dati: number;
}

export interface KpiMeseItem {
  mese: number;
  produzione: number;
  incasso: number;
  ore_cliniche: number;
  ricavo_orario: number;
  costi_totali: number;
  margine: number;
  saturazione: number;
  num_fatture: number;
  num_appuntamenti: number;
}

export interface KpiMonthly {
  anno: number;
  mesi: KpiMeseItem[];
}

export interface Operatore {
  medico_id: number;
  medico_nome: string;
  ore_cliniche: number;
  num_appuntamenti: number;
  produzione: number;
  ricavo_orario: number;
}

export interface KpiByOperator {
  anno: number;
  operatori: Operatore[];
}

export interface Categoria {
  tipo: string;
  tipo_nome: string;
  ore_cliniche: number;
  num_appuntamenti: number;
  percentuale: number;
}

export interface KpiByCategory {
  anno: number;
  categorie: Categoria[];
}

export interface ConfrontoMese {
  mese: number;
  produzione_corrente: number;
  produzione_precedente: number;
  delta_produzione: number;
  delta_produzione_pct: number;
  margine_corrente: number;
  margine_precedente: number;
  ore_cliniche_corrente: number;
  ore_cliniche_precedente: number;
  ricavo_orario_corrente: number;
  ricavo_orario_precedente: number;
}

export interface KpiComparison {
  anno_corrente: number;
  anno_precedente: number;
  confronto: ConfrontoMese[];
  totali: {
    produzione_corrente: number;
    produzione_precedente: number;
    delta: number;
    delta_pct: number;
  };
}

export interface Scenario {
  produzione: number;
  costi: number;
  margine: number;
  margine_pct: number;
  pipeline_convertita: number;
}

export interface ForecastMese {
  mese: number;
  reale: number | null;
  previsto: number | null;
  costi_reali: number | null;
  tipo: 'reale' | 'previsto';
}

export interface ForecastData {
  anno: number;
  mese_corrente: number;
  produzione_ytd: number;
  forecast_produzione: number;
  forecast_margine: number;
  pipeline_preventivi: number;
  scenario_conservativo: Scenario;
  scenario_realistico: Scenario;
  scenario_ottimistico: Scenario;
  mesi: ForecastMese[];
  parametri: {
    fattore_trend: number;
    media_globale_mensile: number;
    crescita_annuale_pct: number;
    anni_storico: number;
  };
}

export interface SimulazioneParams {
  anno?: number;
  aumento_tariffa_pct: number;
  aumento_saturazione_pct: number;
  nuovo_operatore: boolean;
  costo_nuovo_operatore: number;
  riduzione_costi_pct: number;
  aumento_ore_cliniche: number;
}

export interface SimulazioneResult {
  anno: number;
  base: { produzione: number; costi: number; margine: number };
  simulato: { produzione: number; costi: number; margine: number; margine_pct: number };
  delta: { produzione: number; margine: number; produzione_pct: number };
  dettaglio_impatti: Record<string, number>;
  parametri_usati: SimulazioneParams;
}

export interface SeasonalityData {
  indici: Record<number, number>;
  media_globale_mensile: number;
  medie_per_mese: Record<number, number>;
  mese_migliore: { mese: number; indice: number };
  mese_peggiore: { mese: number; indice: number };
  anni_analizzati: number;
  range_anni: string;
  affidabilita: string;
}

export interface TrendData {
  crescita_annuale_pct: number;
  trend_direction: string;
  r_squared_annuale: number;
  trend_12_mesi_pct: number;
  proiezione_mese_corrente: number;
  anni_analizzati: number;
  range_anni: string;
  anni_trend: Array<{ anno: number; produzione: number }>;
  ultimi_12_mesi: Array<{ anno: number; mese: number; produzione: number }>;
}
