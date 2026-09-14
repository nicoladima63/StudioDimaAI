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
export interface OrdineMateriali {
  id: number;
  fornitore_nome: string;
  data_ordine: string;
  data_ricezione: string | null;
  stato: 'ordinato' | 'ricevuto' | 'annullato';
  righe: Pick<PianoAcquisto, 'materiale_id' | 'nome' | 'codice' | 'quantita' | 'unita' | 'note'>[];
}
export interface OrdiniData { piani: PianoAcquisto[]; ordini: OrdineMateriali[] }
const base = '/materiali/ordini';
export const ordiniService = {
  async load(): Promise<OrdiniData> { return (await apiClient.get(base)).data.data; },
  async save(plan: PianoAcquisto) { await apiClient.put(`${base}/piani/${plan.materiale_id}`, plan); },
  async queue(id: number, action: 'aggiungi' | 'terminato' | 'rimuovi') { await apiClient.post(`${base}/lista/${id}/${action}`); },
  async order(ids: number[]) { await apiClient.post(base, { materiale_ids: ids }); },
  async transition(id: number, action: 'ricevuto' | 'annullato') { await apiClient.post(`${base}/${id}/${action}`); },
};
