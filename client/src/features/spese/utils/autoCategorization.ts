/**
 * Sistema di classificazione fornitori basato su struttura gerarchica conto->branca->sottoconto
 * La nuova logica utilizza solo le classificazioni dal database studio_dima.db
 */

export interface SpesaFornitore {
  codice_fornitore?: string;
  nome_fornitore?: string;
  descrizione?: string;
  numero_documento?: string;
  categoria?: number;
}

export interface ClassificazioneResult {
  contoid?: number | null;
  contonome?: string | null;
  brancaid?: number | null;
  brancanome?: string | null;
  sottocontoid?: number | null;
  sottocontonome?: string | null;
  confidence: number;
  motivo: string;
  algoritmo: string;
}

interface FornitoreClassificazioneAPI {
  contoid?: number | null;
  contonome?: string | null;
  brancaid?: number | null;
  brancanome?: string | null;
  sottocontoid?: number | null;
  sottocontonome?: string | null;
  confidence: number;
  motivo: string;
  algoritmo: string;
}

/**
 * Chiama l'API per ottenere la classificazione suggerita per un fornitore
 */
async function getClassificazioneFornitore(codiceFornitore: string): Promise<FornitoreClassificazioneAPI | null> {
  try {
    const response = await fetch(`/api/classificazioni/fornitore/${codiceFornitore}/suggest-categoria`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
    
    return null;
  } catch (error) {
    console.error('Errore chiamata API classificazione fornitore:', error);
    return null;
  }
}

/**
 * Funzione principale per ottenere la classificazione suggerita per una spesa fornitore
 * Utilizza solo le classificazioni esistenti nel database (conto->branca->sottoconto)
 * Solo fornitori con classificazione completa (3 livelli) vengono considerati
 */
export async function getClassificazioneSpesaFornitore(spesa: SpesaFornitore): Promise<ClassificazioneResult> {
  // Verifica classificazione fornitore esistente
  if (spesa.codice_fornitore) {
    try {
      const fornitoreClassificazione = await getClassificazioneFornitore(spesa.codice_fornitore);
      
      if (fornitoreClassificazione) {
        // Controlla se è una classificazione completa (3 livelli)
        const isCompleta = fornitoreClassificazione.contoid && 
                          fornitoreClassificazione.brancaid && 
                          fornitoreClassificazione.sottocontoid;
        
        if (isCompleta) {
          return {
            contoid: fornitoreClassificazione.contoid,
            contonome: fornitoreClassificazione.contonome,
            brancaid: fornitoreClassificazione.brancaid,
            brancanome: fornitoreClassificazione.brancanome,
            sottocontoid: fornitoreClassificazione.sottocontoid,
            sottocontonome: fornitoreClassificazione.sottocontonome,
            confidence: fornitoreClassificazione.confidence,
            motivo: fornitoreClassificazione.motivo,
            algoritmo: fornitoreClassificazione.algoritmo
          };
        }
      }
    } catch (error) {
      console.warn('Errore nel recupero classificazione fornitore:', error);
    }
  }
  
  // Nessuna classificazione completa disponibile
  return {
    contoid: null,
    contonome: null,
    brancaid: null,
    brancanome: null,
    sottocontoid: null,
    sottocontonome: null,
    confidence: 0,
    motivo: 'Fornitore non classificato o classificazione incompleta',
    algoritmo: 'none'
  };
}

// Tutte le funzioni legacy sono state rimosse in quanto incompatibili con il nuovo sistema
// di classificazione basato su conto->branca->sottoconto