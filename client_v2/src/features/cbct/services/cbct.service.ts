import apiClient from '@/services/api/client'

export interface EsameCbct {
  portal_exam_id: string
  codice_paziente: string
  paziente_raw: string
  data_nascita: string
  accession_number: string
  data_esame: string
  descrizione: string
  dentista: string
  download_count_portale: number
  disponibile_fino_al: string
  imaging_center: string
  gia_scaricato: boolean
  cartella_nas: string | null
  percorso_nas: string | null
}

export interface RisultatoDownload {
  portal_exam_id: string
  cartella_nas: string
  percorso_nas: string
}

/** Converte un percorso UNC (\\servernas\CBTC\CARTELLA) in un link file:// */
export function percorsoNasToFileUrl(percorsoNas: string): string {
  return 'file://' + percorsoNas.replace(/^\\\\/, '').replace(/\\/g, '/')
}

export const cbctService = {
  async getListaEsami(): Promise<EsameCbct[]> {
    try {
      const response = await apiClient.get('cbct/esami')
      return response.data.data || []
    } catch (err: any) {
      throw new Error(err.message || 'Errore caricamento lista esami dal portale')
    }
  },

  async scaricaEsame(esame: EsameCbct): Promise<RisultatoDownload> {
    try {
      const response = await apiClient.post(
        `cbct/esami/${esame.portal_exam_id}/scarica`,
        {
          paziente_raw: esame.paziente_raw,
          data_esame: esame.data_esame,
        },
        { timeout: 300000 }
      )
      return response.data.data
    } catch (err: any) {
      throw new Error(err.message || 'Errore durante il download dell\'esame')
    }
  },
}

export default cbctService
