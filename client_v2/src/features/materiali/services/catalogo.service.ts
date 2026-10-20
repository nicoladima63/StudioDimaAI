import apiClient from '@/services/api/client'
import type {
  AggiungiVoceInput,
  AggiungiVociRisposta,
  ClassificazioneIds,
  FornitoreOption,
  ProdottoDettaglio,
  RicercaProdottiParams,
  RicercaProdottiRisposta,
  RispostaConStato,
  VociGestionaleRisposta,
} from '../types/catalogo'

const base = '/materiali/catalogo'

const catalogoService = {
  async apiRicercaProdotti(params: RicercaProdottiParams): Promise<RicercaProdottiRisposta> {
    const query = {
      ...params,
      archiviati: params.archiviati ? 1 : undefined,
      contoid: params.contoid || undefined,
      brancaid: params.brancaid || undefined,
      sottocontoid: params.sottocontoid || undefined,
      fornitore_id: params.fornitore_id || undefined,
      stato: params.stato || undefined,
      q: params.q?.trim() || undefined,
    }
    const res = await apiClient.get(`${base}/prodotti`, { params: query })
    return res.data.data
  },

  async apiGetFornitori(origine: 'catalogo' | 'gestionale'): Promise<FornitoreOption[]> {
    const res = await apiClient.get(`${base}/fornitori`, { params: { origine } })
    return res.data.data
  },

  async apiGetProdotto(id: number): Promise<ProdottoDettaglio> {
    const res = await apiClient.get(`${base}/prodotti/${id}`)
    return res.data.data
  },

  async apiUpdateProdotto(
    id: number,
    data: Partial<Pick<ProdottoDettaglio, 'nome' | 'unita_base' | 'soglia_minima' | 'note'>>
  ): Promise<ProdottoDettaglio> {
    const res = await apiClient.put(`${base}/prodotti/${id}`, data)
    return res.data.data
  },

  async apiClassificaProdotti(ids: number[], classificazione: ClassificazioneIds): Promise<{ aggiornati: number }> {
    const res = await apiClient.post(`${base}/prodotti/classifica`, { ids, classificazione })
    return res.data.data
  },

  async apiUnisciProdotti(
    targetId: number,
    sourceIds: number[]
  ): Promise<{ offerte_spostate: number; classificazioni_diverse_ignorate: number }> {
    const res = await apiClient.post(`${base}/prodotti/unisci`, { target_id: targetId, source_ids: sourceIds })
    return res.data.data
  },

  async apiArchiviaProdotto(id: number, archiviato: boolean): Promise<void> {
    await apiClient.post(`${base}/prodotti/${id}/archivia`, { archiviato })
  },

  async apiUpdateOfferta(
    id: number,
    data: { pezzi_per_confezione?: number; unita_acquisto?: string }
  ): Promise<ProdottoDettaglio> {
    const res = await apiClient.put(`${base}/offerte/${id}`, data)
    return res.data.data
  },

  async apiSeparaOfferta(id: number): Promise<{ prodotto_id: number }> {
    const res = await apiClient.post(`${base}/offerte/${id}/separa`)
    return res.data.data
  },

  async apiGetVociGestionale(params: {
    q?: string
    fornitore_id?: string
    tutte?: boolean
    page: number
    per_page: number
    refresh?: boolean
  }): Promise<RispostaConStato<VociGestionaleRisposta>> {
    const res = await apiClient.get(`${base}/voci-gestionale`, {
      params: {
        ...params,
        q: params.q?.trim() || undefined,
        fornitore_id: params.fornitore_id || undefined,
        tutte: params.tutte ? 1 : undefined,
        refresh: params.refresh ? 1 : undefined,
      },
    })
    return { data: res.data.data, state: res.data.state ?? 'success', message: res.data.message }
  },

  async apiAggiungiVoci(voci: AggiungiVoceInput[]): Promise<AggiungiVociRisposta> {
    const res = await apiClient.post(`${base}/voci-gestionale/aggiungi`, { voci })
    return res.data.data
  },
}

export default catalogoService
