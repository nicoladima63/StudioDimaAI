/** Ricerca pura: nessun caricamento, raggruppamento o filtro implicito. */
export interface RigaRicercabile {
  nome?: string | null;
  codicearticolo?: string | null;
  fornitoreid?: string | null;
  fornitorenome?: string | null;
  tipo_di_costo?: number | null;
  contoid?: number | null;
  brancaid?: number | null;
  sottocontoid?: number | null;
  confermato?: number | null;
}

export type CampoRicerca = 'nome' | 'codicearticolo' | 'fornitorenome';
export interface FiltriRicercaMateriali {
  testo?: string;
  campi?: readonly CampoRicerca[];
  tipiCosto?: readonly (1 | 2 | 3)[];
  fornitoriId?: readonly string[];
  contiId?: readonly number[];
  brancheId?: readonly number[];
  sottocontiId?: readonly number[];
  confermato?: boolean;
  iniziale?: string;
}
export interface ContestoRicerca<T> {
  /** Nome ufficiale e alias storici restano entrambi ricercabili. */
  fornitori?: Readonly<Record<string, { nome: string }>>;
  /** Deve restituire la classificazione effettiva della riga, se disponibile. */
  tipoCosto?: (riga: T) => number | null | undefined;
}

export const normalizzaRicerca = (value: string | null | undefined): string =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it').trim().replace(/\s+/g, ' ');

/**
 * Tutte le parole devono comparire nei campi scelti, anche in ordine diverso.
 * Filtri diversi si combinano in AND; valori dello stesso filtro in OR.
 * Liste vuote equivalgono a filtro disattivato. Valori mancanti non soddisfano
 * un filtro attivo. Preserva righe, duplicati e ordine dell'input.
 */
export function ricercaMateriali<T extends RigaRicercabile>(
  righe: readonly T[], filtri: FiltriRicercaMateriali = {}, contesto: ContestoRicerca<T> = {},
): T[] {
  const parole = normalizzaRicerca(filtri.testo).split(' ').filter(Boolean);
  const campi = filtri.campi ?? ['nome', 'codicearticolo', 'fornitorenome'];
  const iniziale = normalizzaRicerca(filtri.iniziale);
  const incluso = <V,>(valori: readonly V[] | undefined, valore: V | null | undefined) =>
    !valori?.length || (valore != null && valori.includes(valore));
  return righe.filter(riga => {
    if (!incluso(filtri.fornitoriId, riga.fornitoreid) ||
        !incluso(filtri.contiId, riga.contoid) ||
        !incluso(filtri.brancheId, riga.brancaid) ||
        !incluso(filtri.sottocontiId, riga.sottocontoid) ||
        !incluso<number>(filtri.tipiCosto, contesto.tipoCosto ? contesto.tipoCosto(riga) : riga.tipo_di_costo)) return false;
    if (filtri.confermato !== undefined && riga.confermato !== (filtri.confermato ? 1 : 0)) return false;
    const prima = normalizzaRicerca(riga.nome).charAt(0);
    if (iniziale && (iniziale === '#' ? !prima || /^[a-z]$/.test(prima) : prima !== iniziale)) return false;
    const testi = campi.flatMap(campo => campo === 'fornitorenome'
      ? [normalizzaRicerca(riga.fornitorenome), normalizzaRicerca(contesto.fornitori?.[riga.fornitoreid || '']?.nome)]
      : [normalizzaRicerca(riga[campo])]);
    return parole.every(parola => testi.some(testo => testo.includes(parola)));
  });
}
