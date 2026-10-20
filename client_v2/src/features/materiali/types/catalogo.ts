export type StatoProdotto = 'classificato' | 'parziale' | 'da_classificare'

export interface ClassificazioneIds {
  contoid: number | null
  brancaid: number | null
  sottocontoid: number | null
}

export interface ClassificazioneNomi {
  contonome: string | null
  brancanome: string | null
  sottocontonome: string | null
}

export interface FornitoreOption {
  id: string
  nome: string
  n: number
}

export interface OffertaSintesi {
  id: number
  prodotto_id: number
  fornitore_id: string
  fornitore_nome: string
  codice: string
  ultimo_prezzo: number | null
  pezzi_per_confezione: number
}

export interface ProdottoCatalogo extends ClassificazioneIds, ClassificazioneNomi {
  id: number
  nome: string
  stato: StatoProdotto
  archiviato: number
  unita_base: string
  soglia_minima: number | null
  note: string
  n_offerte: number
  ultimo_acquisto: string | null
  miglior_prezzo_unitario: number | null
  offerte: OffertaSintesi[]
}

export interface AcquistoRiga {
  id: number
  fattura_id: string
  riga: number
  numero_documento: string
  data: string
  quantita: number | null
  prezzo_unitario: number | null
  sconto: number | null
  lotto: string
}

export interface OffertaDettaglio extends OffertaSintesi {
  nome: string
  unita_acquisto: string
  confezione_fonte: 'default' | 'fattura' | 'manuale'
  ultimo_acquisto: string | null
  origine: string
  prezzo_unitario_base: number | null
  acquisti: AcquistoRiga[]
}

export interface ProdottoDettaglio extends ClassificazioneIds, ClassificazioneNomi {
  id: number
  nome: string
  stato: StatoProdotto
  archiviato: number
  unita_base: string
  soglia_minima: number | null
  note: string
  offerte: OffertaDettaglio[]
}

export interface Paginazione {
  page: number
  per_page: number
  total: number
  pages: number
}

export interface RicercaProdottiParams {
  q?: string
  fornitore_id?: string
  contoid?: number | null
  brancaid?: number | null
  sottocontoid?: number | null
  stato?: StatoProdotto | ''
  archiviati?: boolean
  page: number
  per_page: number
  sort: string
  dir: 'asc' | 'desc'
}

export interface RicercaProdottiRisposta {
  prodotti: ProdottoCatalogo[]
  riepilogo: Partial<Record<StatoProdotto, number>>
  pagination: Paginazione
}

export interface PropostaClassificazione extends ClassificazioneIds, ClassificazioneNomi {
  fonte: 'stesso_nome_in_catalogo' | 'famiglia_prodotti' | 'fornitore_completo' | 'fornitore_parziale'
  confidence: number
  riferimento: string
}

export interface VoceGestionale {
  fornitore_id: string
  fornitore_nome: string
  codice: string
  nome: string
  n_acquisti: number
  ultimo_acquisto: string
  ultimo_prezzo: number | null
  fatture: { fattura_id: string; numero_documento: string; data: string }[]
  in_catalogo: boolean
  offerta_id: number | null
  prodotto_id: number | null
  proposta: PropostaClassificazione | null
}

export interface VociGestionaleRisposta {
  voci: VoceGestionale[]
  pagination: Paginazione
}

export interface AggiungiVoceInput {
  fornitore_id: string
  codice: string
  nome: string
  classificazione?: ClassificazioneIds
}

export interface AggiungiVociRisposta {
  creati: number
  errori: number
  risultati: { nome: string; offerta_id?: number; prodotto_id?: number; creata?: boolean; errore?: string }[]
}

export type StatoRisposta = 'success' | 'warning' | 'error'

export interface RispostaConStato<T> {
  data: T
  state: StatoRisposta
  message?: string
}
