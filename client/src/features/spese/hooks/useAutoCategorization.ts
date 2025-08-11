import { useMemo } from 'react';
import type { SpesaFornitore } from '@/features/spese/types';
import {
  categorizzaSpesaFornitore,
  categorizzaSpesaFornitoreSync,
  getSuggerimentiMiglioramento,
  getStatisticheCategorizzazione,
  esportaCategorizzazioni,
  esportaCategorizzazioniSync,
  CategoriaSpesa,
  CATEGORIE_LABELS,
  type CategorizzazioneResult
} from '../utils/autoCategorization';

export interface UseAutoCategorization {
  categorizzaSpesa: (spesa: SpesaFornitore) => Promise<CategorizzazioneResult>;
  categorizzaSpesaSync: (spesa: SpesaFornitore) => CategorizzazioneResult; // Versione sincrona per backward compatibility
  categorizzaLotto: (spese: SpesaFornitore[]) => Promise<Array<SpesaFornitore & CategorizzazioneResult>>;
  categorizzaLottoSync: (spese: SpesaFornitore[]) => Array<SpesaFornitore & CategorizzazioneResult>; // Versione sincrona
  getStatistiche: (spese: SpesaFornitore[]) => ReturnType<typeof getStatisticheCategorizzazione>;
  getSuggerimenti: (spese: SpesaFornitore[]) => string[];
  categorie: typeof CategoriaSpesa;
  categorieLabels: typeof CATEGORIE_LABELS;
  getCategoriaLabel: (categoria: CategoriaSpesa) => string;
  getCategoriaColor: (categoria: CategoriaSpesa) => string;
  getConfidenceLevel: (confidence: number) => 'low' | 'medium' | 'high';
  getConfidenceLabel: (confidence: number) => string;
}

/**
 * Colori per le categorie (compatibili con CoreUI)
 */
const CATEGORIA_COLORS: Record<CategoriaSpesa, string> = {
  [CategoriaSpesa.ENERGIA_ELETTRICA]: 'warning',
  [CategoriaSpesa.GAS_METANO]: 'warning',
  [CategoriaSpesa.ACQUA_UTENZE]: 'info',
  [CategoriaSpesa.TELECOMUNICAZIONI]: 'primary',
  [CategoriaSpesa.INTERNET_HOSTING]: 'primary',
  [CategoriaSpesa.MATERIALI_DENTALI]: 'success',
  [CategoriaSpesa.APPARECCHIATURE_MEDICHE]: 'success',
  [CategoriaSpesa.FARMACEUTICI]: 'danger',
  [CategoriaSpesa.LEASING_FINANZIARIO]: 'dark',
  [CategoriaSpesa.CONSULENZE_PROFESSIONALI]: 'secondary',
  [CategoriaSpesa.SERVIZI_BANCARI]: 'dark',
  [CategoriaSpesa.MANUTENZIONI_RIPARAZIONI]: 'warning',
  [CategoriaSpesa.ASSICURAZIONI]: 'info',
  [CategoriaSpesa.FORMAZIONE_AGGIORNAMENTO]: 'success',
  [CategoriaSpesa.TASSE_IMPOSTE]: 'danger',
  [CategoriaSpesa.AFFITTI_LOCAZIONI]: 'secondary',
  [CategoriaSpesa.CARBURANTI]: 'warning',
  [CategoriaSpesa.ALTRO]: 'light'
};

/**
 * Hook per la gestione dell'auto-categorizzazione delle spese fornitori
 */
export function useAutoCategorization(): UseAutoCategorization {
  
  const categorizzaSpesa = useMemo(() => {
    return async (spesa: SpesaFornitore): Promise<CategorizzazioneResult> => {
      return await categorizzaSpesaFornitore(spesa);
    };
  }, []);

  const categorizzaSpesaSync = useMemo(() => {
    return (spesa: SpesaFornitore): CategorizzazioneResult => {
      return categorizzaSpesaFornitoreSync(spesa);
    };
  }, []);

  const categorizzaLotto = useMemo(() => {
    return async (spese: SpesaFornitore[]): Promise<Array<SpesaFornitore & CategorizzazioneResult>> => {
      return await esportaCategorizzazioni(spese);
    };
  }, []);

  const categorizzaLottoSync = useMemo(() => {
    return (spese: SpesaFornitore[]): Array<SpesaFornitore & CategorizzazioneResult> => {
      return esportaCategorizzazioniSync(spese);
    };
  }, []);

  const getStatistiche = useMemo(() => {
    return (spese: SpesaFornitore[]) => {
      return getStatisticheCategorizzazione(spese);
    };
  }, []);

  const getSuggerimenti = useMemo(() => {
    return (spese: SpesaFornitore[]): string[] => {
      return getSuggerimentiMiglioramento(spese);
    };
  }, []);

  const getCategoriaLabel = useMemo(() => {
    return (categoria: CategoriaSpesa): string => {
      return CATEGORIE_LABELS[categoria] || categoria;
    };
  }, []);

  const getCategoriaColor = useMemo(() => {
    return (categoria: CategoriaSpesa): string => {
      return CATEGORIA_COLORS[categoria] || 'secondary';
    };
  }, []);

  const getConfidenceLevel = useMemo(() => {
    return (confidence: number): 'low' | 'medium' | 'high' => {
      if (confidence >= 0.8) return 'high';
      if (confidence >= 0.5) return 'medium';
      return 'low';
    };
  }, []);

  const getConfidenceLabel = useMemo(() => {
    return (confidence: number): string => {
      const level = getConfidenceLevel(confidence);
      const percentage = Math.round(confidence * 100);
      
      switch (level) {
        case 'high':
          return `Alta (${percentage}%)`;
        case 'medium':
          return `Media (${percentage}%)`;
        case 'low':
          return `Bassa (${percentage}%)`;
        default:
          return `${percentage}%`;
      }
    };
  }, [getConfidenceLevel]);

  return {
    categorizzaSpesa,
    categorizzaSpesaSync,
    categorizzaLotto,
    categorizzaLottoSync,
    getStatistiche,
    getSuggerimenti,
    categorie: CategoriaSpesa,
    categorieLabels: CATEGORIE_LABELS,
    getCategoriaLabel,
    getCategoriaColor,
    getConfidenceLevel,
    getConfidenceLabel
  };
}

/**
 * Hook per statistiche di categorizzazione in tempo reale
 */
export function useStatisticheCategorizzazione(spese: SpesaFornitore[]) {
  const { getStatistiche } = useAutoCategorization();
  
  return useMemo(() => {
    if (!spese || spese.length === 0) {
      return {
        totaleSpese: 0,
        speseRiconosciute: 0,
        percentualeRiconoscimento: 0,
        dettagliCategorie: []
      };
    }
    
    return getStatistiche(spese);
  }, [spese, getStatistiche]);
}

/**
 * Hook per suggerimenti di miglioramento
 */
export function useSuggerimentiCategorizzazione(spese: SpesaFornitore[]) {
  const { getSuggerimenti } = useAutoCategorization();
  
  return useMemo(() => {
    if (!spese || spese.length === 0) {
      return [];
    }
    
    return getSuggerimenti(spese);
  }, [spese, getSuggerimenti]);
}