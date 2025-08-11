/**
 * Sistema di auto-learning per il miglioramento continuo della classificazione
 */

import apiClient from '@/api/client';
import { CategoriaSpesa } from './autoCategorization';

interface LearningResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Aggiorna il pattern di learning per un fornitore quando l'utente conferma una categorizzazione
 */
export async function updateFornitorePatternLearning(
  fornitoreId: string,
  categoriaMateriale: CategoriaSpesa,
  fonte: 'materiale_confermato' | 'fornitore_manuale' = 'materiale_confermato'
): Promise<LearningResult> {
  try {
    // Mappa la categoria materiale al codice conto corrispondente
    const codiceConto = mapCategoriaToCodice(categoriaMateriale);
    
    if (!codiceConto) {
      return {
        success: false,
        error: 'Categoria non mappabile a codice conto'
      };
    }

    const response = await apiClient.post(`/api/classificazioni/fornitore/${fornitoreId}/learn-pattern`, {
      categoria_confermata: codiceConto,
      fonte
    });

    if (response.data.success) {
      return {
        success: true,
        message: response.data.message
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Errore nell\'aggiornamento del pattern learning'
      };
    }
  } catch (error) {
    console.error('Errore updateFornitorePatternLearning:', error);
    return {
      success: false,
      error: 'Errore di connessione al server'
    };
  }
}

/**
 * Mappa una categoria di spesa al codice conto corrispondente (inversa del mapping in autoCategorization)
 */
function mapCategoriaToCodice(categoria: CategoriaSpesa): string | null {
  const mapping: Record<CategoriaSpesa, string> = {
    [CategoriaSpesa.MATERIALI_DENTALI]: 'ZZZZZI',
    [CategoriaSpesa.ENERGIA_ELETTRICA]: 'ZZZZZU',
    [CategoriaSpesa.GAS_METANO]: 'ZZZZZU', // Stesso conto energia
    [CategoriaSpesa.TELECOMUNICAZIONI]: 'ZZZZZN',
    [CategoriaSpesa.CONSULENZE_PROFESSIONALI]: 'ZZZZXR',
    [CategoriaSpesa.FARMACEUTICI]: 'ZZZZZK',
    [CategoriaSpesa.LEASING_FINANZIARIO]: 'ZZZZYL',
    [CategoriaSpesa.INTERNET_HOSTING]: 'ZZZZZN', // Stesso conto telecomunicazioni
    [CategoriaSpesa.ACQUA_UTENZE]: 'ZZZZZU', // Stesso conto energia/utenze
    [CategoriaSpesa.APPARECCHIATURE_MEDICHE]: 'ZZZZZI', // Stesso conto materiali dentali
    [CategoriaSpesa.SERVIZI_BANCARI]: 'ZZZZXR', // Stesso conto consulenze
    [CategoriaSpesa.MANUTENZIONI_RIPARAZIONI]: 'ZZZZXR', // Stesso conto consulenze
    [CategoriaSpesa.ASSICURAZIONI]: 'ZZZZXR', // Stesso conto consulenze
    [CategoriaSpesa.FORMAZIONE_AGGIORNAMENTO]: 'ZZZZXR', // Stesso conto consulenze
    [CategoriaSpesa.TASSE_IMPOSTE]: 'ZZZZXR', // Stesso conto consulenze per ora
    [CategoriaSpesa.AFFITTI_LOCAZIONI]: 'ZZZZYL', // Stesso conto leasing
    [CategoriaSpesa.CARBURANTI]: 'ZZZZZU', // Stesso conto energia/utenze
    [CategoriaSpesa.ALTRO]: 'ZZZZXR' // Mappa ad un conto generico
  };
  
  return mapping[categoria] || null;
}

/**
 * Esegue auto-learning in batch per una lista di materiali classificati
 */
export async function batchUpdateFornitoriLearning(
  materialiClassificati: Array<{
    codice_fornitore?: string;
    categoria: CategoriaSpesa;
  }>
): Promise<{
  aggiornamenti_riusciti: number;
  aggiornamenti_falliti: number;
  dettagli: LearningResult[];
}> {
  const risultati: LearningResult[] = [];
  let riusciti = 0;
  let falliti = 0;

  for (const materiale of materialiClassificati) {
    if (!materiale.codice_fornitore) {
      falliti++;
      risultati.push({
        success: false,
        error: 'Codice fornitore mancante'
      });
      continue;
    }

    const risultato = await updateFornitorePatternLearning(
      materiale.codice_fornitore,
      materiale.categoria,
      'materiale_confermato'
    );

    risultati.push(risultato);
    
    if (risultato.success) {
      riusciti++;
    } else {
      falliti++;
    }

    // Pausa breve per non sovraccaricare il server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    aggiornamenti_riusciti: riusciti,
    aggiornamenti_falliti: falliti,
    dettagli: risultati
  };
}

/**
 * Hook per il learning automatico integrato con la conferma materiali
 */
export function useAutoLearning() {
  /**
   * Esegue auto-learning quando un materiale viene confermato
   */
  const onMaterialeConfermato = async (
    materiale: {
      fornitoreid: string;
      categoria_contabile?: string;
    },
    categoriaConfermata: CategoriaSpesa
  ) => {
    if (!materiale.fornitoreid) {
      console.warn('Auto-learning: Fornitore ID mancante per materiale');
      return;
    }

    try {
      const risultato = await updateFornitorePatternLearning(
        materiale.fornitoreid,
        categoriaConfermata,
        'materiale_confermato'
      );

      if (risultato.success) {
        console.log(`Auto-learning: Pattern aggiornato per fornitore ${materiale.fornitoreid}:`, risultato.message);
      } else {
        console.warn(`Auto-learning fallito per fornitore ${materiale.fornitoreid}:`, risultato.error);
      }
    } catch (error) {
      console.error('Auto-learning: Errore non gestito:', error);
    }
  };

  /**
   * Esegue auto-learning quando un fornitore viene categorizzato manualmente
   */
  const onFornitoreCategorizaatoManualmente = async (
    fornitoreId: string,
    codiceConto: string
  ) => {
    try {
      const response = await apiClient.post(`/api/classificazioni/fornitore/${fornitoreId}/learn-pattern`, {
        categoria_confermata: codiceConto,
        fonte: 'fornitore_manuale'
      });

      if (response.data.success) {
        console.log(`Auto-learning: Fornitore ${fornitoreId} categorizzato manualmente`);
      }
    } catch (error) {
      console.error('Auto-learning: Errore categorizzazione manuale fornitore:', error);
    }
  };

  return {
    onMaterialeConfermato,
    onFornitoreCategorizaatoManualmente,
    updateFornitorePatternLearning,
    batchUpdateFornitoriLearning
  };
}