// ========== KPI ==========

export interface KpiCurrent {
  anno: number
  mese_corrente: number
  produzione_ytd: number
  incasso_ytd: number
  ore_cliniche_ytd: number
  costi_totali_ytd: number
  costi_diretti_ytd: number
  costi_indiretti_ytd: number
  costi_non_deducibili_ytd: number
  costi_non_classificati_ytd: number
  margine_ytd: number
  ricavo_medio_ora: number
  costo_orario_totale: number
  margine_pct: number
  break_even_mensile: number
  produzione_media_mensile: number
  margine_contribuzione: number
  num_fatture_ytd: number
  num_appuntamenti_ytd: number
  mesi_con_dati: number
}

export interface KpiMeseItem {
  mese: number
  produzione: number
  incasso: number
  ore_cliniche: number
  ricavo_orario: number
  costi_totali: number
  costi_diretti: number
  costi_indiretti: number
  costi_non_deducibili: number
  costi_non_classificati: number
  margine: number
  saturazione: number
}

export interface KpiMonthly {
  anno: number
  mesi: KpiMeseItem[]
}

export interface Operatore {
  codice: string
  produzione: number
  ore_cliniche: number
  ricavo_orario: number
  num_appuntamenti: number
}

export interface KpiByOperator {
  anno: number
  operatori: Operatore[]
}

export interface Categoria {
  tipo: string
  descrizione: string
  num_appuntamenti: number
  ore_totali: number
}

export interface KpiByCategory {
  anno: number
  categorie: Categoria[]
}

export interface ConfrontoMese {
  mese: number
  produzione_corrente: number
  produzione_precedente: number
  delta: number
  delta_pct: number
}

export interface KpiComparison {
  anno_corrente: number
  anno_precedente: number
  confronto: ConfrontoMese[]
  totale_corrente: number
  totale_precedente: number
  delta_totale: number
  delta_totale_pct: number
}

// ========== FORECAST ==========

export interface Scenario {
  produzione: number
  margine: number
}

export interface ForecastMese {
  mese: number
  reale: number | null
  previsto: number | null
}

export interface ForecastData {
  anno: number
  forecast_produzione: number
  forecast_margine: number
  scenario_conservativo: Scenario
  scenario_realistico: Scenario
  scenario_ottimistico: Scenario
  mesi: ForecastMese[]
}

// ========== SIMULAZIONE ==========

export interface SimulazioneParams {
  aumento_tariffa_pct: number
  aumento_saturazione_pct: number
  nuovo_operatore: boolean
  costo_nuovo_operatore: number
  riduzione_costi_pct: number
  aumento_ore_cliniche: number
}

export interface SimulazioneScenario {
  produzione: number
  costi: number
  margine: number
  margine_pct: number
}

export interface SimulazioneDelta {
  produzione: number
  margine: number
  produzione_pct: number
}

export interface SimulazioneResult {
  base: SimulazioneScenario
  simulato: SimulazioneScenario
  delta: SimulazioneDelta
  dettaglio_impatti: Record<string, number>
}

// ========== MULTI-YEAR COMPARISON ==========

export interface MeseAnno {
  mese: number
  produzione: number
  costi: number
  margine: number
  ore_cliniche: number
}

export interface DatiAnno {
  anno: number
  mesi: MeseAnno[]
  totale_produzione: number
  totale_costi: number
  totale_margine: number
}

export interface ForecastMeseMulti {
  mese: number
  tipo: 'reale' | 'previsto'
  produzione: number
}

export interface ForecastMultiYear {
  anno: number
  mesi: ForecastMeseMulti[]
  totale_previsto: number
}

export interface CrescitaAnnuale {
  da: number
  a: number
  delta: number
  delta_pct: number
}

export interface StatisticheComparative {
  crescita_media_pct: number
  anno_migliore: number
  crescite_annuali: CrescitaAnnuale[]
  media_mensile_globale: number
}

export interface MultiYearComparison {
  anni: number[]
  anno_corrente: number
  mese_corrente: number
  dati_per_anno: Record<string, DatiAnno>
  forecast: ForecastMultiYear
  statistiche: StatisticheComparative
}

// ========== TRIMESTER FORECAST ==========

export interface DettaglioMeseTrimestre {
  mese: number
  tipo: 'reale' | 'previsto'
  produzione: number
  costi: number
}

export interface Trimestre {
  trimestre: number
  nome: string
  label: string
  stato: 'completato' | 'parziale' | 'previsto'
  mesi_reali: number
  mesi_previsti: number
  produzione: number
  produzione_min: number
  produzione_max: number
  costi: number
  margine: number
  margine_pct: number
  dettaglio_mesi: DettaglioMeseTrimestre[]
}

export interface TrimesterForecast {
  anno: number
  mese_corrente: number
  trimestri: Trimestre[]
  totale_annuale: {
    produzione: number
    costi: number
    margine: number
    margine_pct: number
  }
  parametri: {
    fattore_trend: number
    media_globale_mensile: number
    crescita_annuale_pct: number
    anni_storico: number
  }
}

// ========== SEASONALITY & TREND ==========

export interface SeasonalityData {
  indici: Record<string, number>
  anni_analizzati: number
}

export interface TrendData {
  crescita_annuale_pct: number
  trend_direction: string
  proiezione_mese_corrente: number
  r_squared: number
  trend_12_mesi: number
}
