import apiClient from '@/services/api/client';

export interface PianoAcquisto {
  materiale_id: number;
  nome: string;
  codice: string | null;
  fornitore_id: string;
  fornitore_nome: string;
  quantita: number;
  unita: string;
  frequenza_giorni: number | null;
  prossimo_ordine: string | null;
  note: string;
  da_ordinare: number;
  terminato: number;
  in_arrivo: boolean;
  scaduto: boolean;
}
export type StatoOrdine = 'ordinato' | 'ricevuto' | 'annullato';
export interface OrdineMateriali {
  id: number;
  fornitore_nome: string;
  data_ordine: string;
  data_ricezione: string | null;
  stato: StatoOrdine;
  righe: (Pick<PianoAcquisto, 'materiale_id' | 'nome' | 'codice' | 'quantita' | 'unita' | 'note'> & { id: number })[];
}
export interface OrdineModifica {
  data_ordine: string;
  data_ricezione: string | null;
  stato: StatoOrdine;
  righe: { id: number; quantita: number; note: string }[];
}
export interface Segno { chiave: string; tipo: 'preferito' | 'dopo' }
export interface OrdiniData { piani: PianoAcquisto[]; ordini: OrdineMateriali[] }
export interface RigaCarrello {
  materiale_id: number;
  nome: string;
  codice: string | null;
  fornitore_id: string;
  fornitore_nome: string;
  quantita: number;
  aggiornato_da: string | null;
  aggiornato_il: string;
}
const base = '/materiali/ordini';
const carrelloBase = '/materiali/carrello';
export const ordiniService = {
  async load(): Promise<OrdiniData> { return (await apiClient.get(base)).data.data; },
  async save(plan: PianoAcquisto) { await apiClient.put(`${base}/piani/${plan.materiale_id}`, plan); },
  async queue(id: number, action: 'aggiungi' | 'terminato' | 'rimuovi') { await apiClient.post(`${base}/lista/${id}/${action}`); },
  async order(ids: number[]) { await apiClient.post(base, { materiale_ids: ids }); },
  async transition(id: number, action: 'ricevuto' | 'annullato') { await apiClient.post(`${base}/${id}/${action}`); },
  async apiOrdineModifica(id: number, data: OrdineModifica) { await apiClient.put(`${base}/${id}`, data); },
  async apiOrdineElimina(id: number) { await apiClient.delete(`${base}/${id}`); },
  // Preferiti e "salva per dopo": la chiave e' il nome normalizzato del prodotto.
  async apiPreferiti(): Promise<Segno[]> { return (await apiClient.get('/materiali/preferiti')).data.data; },
  async apiPreferitoImposta(chiave: string, tipo: Segno['tipo'], attivo: boolean): Promise<Segno[]> {
    return (await apiClient.post('/materiali/preferiti', { chiave, tipo, attivo })).data.data;
  },
  // Carrello unico condiviso: ogni chiamata restituisce il carrello aggiornato.
  async carrello(): Promise<RigaCarrello[]> { return (await apiClient.get(carrelloBase)).data.data; },
  async carrelloModifica(id: number, change: { delta: number } | { quantita: number }): Promise<RigaCarrello[]> {
    return (await apiClient.post(`${carrelloBase}/${id}`, change)).data.data;
  },
  async carrelloRimuovi(id?: number): Promise<RigaCarrello[]> {
    return (await apiClient.delete(id === undefined ? carrelloBase : `${carrelloBase}/${id}`)).data.data;
  },
  async carrelloOrdina(ids: number[]): Promise<{ ordini: number[]; carrello: RigaCarrello[] }> {
    return (await apiClient.post(`${carrelloBase}/ordina`, { materiale_ids: ids })).data.data;
  },
  async carrelloRiordina(orderId: number): Promise<{ aggiunte: number; saltate: number; carrello: RigaCarrello[] }> {
    return (await apiClient.post(`${carrelloBase}/da-ordine/${orderId}`)).data.data;
  },
};
