import type { AxiosResponse } from 'axios'
import apiClient from '@/api/client'

// Types per le classificazioni materiali (formato BE corretto)
export interface MaterialeClassificazione {
  id: number
  codicearticolo: string
  nome: string
  fornitoreid: string
  fornitorenome: string
  contoid?: number | null
  contonome?: string | null
  brancaid?: number | null
  brancanome?: string | null
  sottocontoid?: number | null
  sottocontonome?: string | null
  categoria_contabile?: string | null
  metodo_classificazione?: 'manuale' | 'automatico' | 'pattern' | null
  confidence: number
  confermato_da_utente: boolean
  stato_classificazione: 'classificato' | 'da_verificare' | 'non_classificato'
  occorrenze: number
}

export interface MaterialiDaClassificareResponse {
  success: boolean
  data: MaterialeClassificazione[]
  total: number
  page: number
  limit: number
  total_pages: number
  stats: {
    classificati: number
    non_classificati: number
    da_verificare: number
  }
  filters_applied: {
    stato: string
    fornitore?: string
  }
}

export interface Conto {
  id: number
  codice: string
  descrizione: string
  tipo: string
  label: string
}

export interface Branca {
  id: number
  nome: string
  contoid: number
  conto_nome: string
}

export interface Sottoconto {
  codice: string
  descrizione: string
  label: string
  fonte: string
}

export interface ContiDisponibiliResponse {
  success: boolean
  data: Conto[]
  total: number
}

export interface BrancheDisponibiliResponse {
  success: boolean
  data: Branca[]
  total: number
}

export interface SottocontiDisponibiliResponse {
  success: boolean
  data: Sottoconto[]
  total: number
  conto_codice: string
}

export interface SalvaClassificazioneRequest {
  codice_articolo: string
  descrizione: string
  codice_fornitore: string
  nome_fornitore: string
  conto_codice: string
  branca_codice?: string
  sottoconto_codice: string
  categoria_contabile?: string
  note?: string
}

export interface SalvaClassificazioneResponse {
  success: boolean
  message: string
  data: {
    id: number
    operazione: 'salvata' | 'aggiornata'
    classificazione: MaterialeClassificazione
  }
}

// Parametri query per filtri
export interface FiltriMateriali {
  stato?: 'tutti' | 'classificati' | 'non_classificati' | 'da_verificare'
  fornitore?: string
  limit?: number
  page?: number
}

const materialiClassificazioniService = {
  /**
   * Ottiene tutti i materiali da classificare
   */
  apiGetMaterialiDaClassificare: async (
    filtri: FiltriMateriali = {}
  ): Promise<MaterialiDaClassificareResponse> => {
    const params = new URLSearchParams()
    
    if (filtri.stato) params.append('stato', filtri.stato)
    if (filtri.fornitore) params.append('fornitore', filtri.fornitore)
    if (filtri.limit) params.append('limit', filtri.limit.toString())
    if (filtri.page) params.append('page', filtri.page.toString())

    const response: AxiosResponse<MaterialiDaClassificareResponse> = 
      await apiClient.get(`/api/spese-fornitori/materiali-da-classificare?${params}`)
    
    return response.data
  },

  /**
   * Ottiene tutti i conti disponibili
   */
  apiGetContiDisponibili: async (): Promise<ContiDisponibiliResponse> => {
    const response: AxiosResponse<ContiDisponibiliResponse> = 
      await apiClient.get('/api/spese-fornitori/conti-disponibili')
    
    return response.data
  },

  /**
   * Ottiene le branche per un conto specifico
   */
  apiGetBrancheDisponibili: async (
    contoId: number
  ): Promise<BrancheDisponibiliResponse> => {
    const response: AxiosResponse<BrancheDisponibiliResponse> = 
      await apiClient.get(`/api/struttura-conti/branche?conto_id=${contoId}`)
    
    return response.data
  },

  /**
   * Ottiene i sottoconti per una branca specifica
   */
  apiGetSottocontiDisponibili: async (
    brancaId: number
  ): Promise<SottocontiDisponibiliResponse> => {
    const response: AxiosResponse<SottocontiDisponibiliResponse> = 
      await apiClient.get(`/api/struttura-conti/sottoconti?branca_id=${brancaId}`)
    
    return response.data
  },

  /**
   * Salva la classificazione di un materiale
   */
  apiSalvaClassificazioneMateriale: async (
    classificazione: SalvaClassificazioneRequest
  ): Promise<SalvaClassificazioneResponse> => {
    const response: AxiosResponse<SalvaClassificazioneResponse> = 
      await apiClient.post('/api/spese-fornitori/salva-classificazione-materiale', classificazione)
    
    return response.data
  },

  /**
   * Elimina la classificazione di un materiale
   */
  apiEliminaClassificazioneMateriale: async (
    codiceArticolo: string,
    descrizione: string,
    codiceFornitore: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete('/api/spese-fornitori/elimina-classificazione-materiale', {
      data: {
        codice_articolo: codiceArticolo,
        descrizione,
        codice_fornitore: codiceFornitore
      }
    })
    
    return response.data
  },

  /**
   * Conferma una classificazione automatica da "da_verificare" a "classificato"
   */
  apiConfermaClassificazioneMateriale: async (
    classificazione: SalvaClassificazioneRequest
  ): Promise<SalvaClassificazioneResponse> => {
    const response: AxiosResponse<SalvaClassificazioneResponse> = 
      await apiClient.post('/api/spese-fornitori/conferma-classificazione-materiale', classificazione)
    
    return response.data
  },

  /**
   * Conferma tutte le classificazioni automatiche da "da_verificare" a "classificato"
   */
  apiConfermaTuttiDaVerificare: async (): Promise<{
    success: boolean;
    message: string;
    materiali_confermati: number;
  }> => {
    const response = await apiClient.post('/api/spese-fornitori/conferma-tutti-da-verificare')
    
    return response.data
  }
}

export default materialiClassificazioniService