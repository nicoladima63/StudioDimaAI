// Utility per calcoli marginalità PKI v2 lato client
import type { KPIMarginalita } from '../services/kpi.service';

interface FatturaRaw {
  id: number;
  paziente_id: number;
  data: string;
  importo: number;
}

interface AppuntamentoRaw {
  id: number;
  paziente_id: number;
  data: string;
  tipo: string;
  tipo_nome?: string;
}

/**
 * Calcola la differenza in giorni tra due date
 */
function daysDiff(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Associa fatture ad appuntamenti e calcola marginalità per tipo prestazione
 * Logica basata sull'esempio del backend PKI v2
 */
export function calcolaMarginalitaV2(
  fatture: FatturaRaw[],
  appuntamenti: AppuntamentoRaw[]
): KPIMarginalita[] {
  
  const marginalita: Record<string, {
    tipo_codice: string;
    tipo_nome: string;
    ricavo_totale: number;
    numero_prestazioni: number;
  }> = {};

  // Associa fatture ad appuntamenti (±7 giorni tolleranza)
  fatture.forEach(fattura => {
    const appCorrispondente = appuntamenti.find(app => 
      app.paziente_id === fattura.paziente_id && 
      daysDiff(app.data, fattura.data) <= 7
    );
    
    if (appCorrispondente) {
      const tipo = appCorrispondente.tipo;
      const tipoNome = appCorrispondente.tipo_nome || tipo;
      
      if (!marginalita[tipo]) {
        marginalita[tipo] = {
          tipo_codice: tipo,
          tipo_nome: tipoNome,
          ricavo_totale: 0,
          numero_prestazioni: 0
        };
      }
      
      marginalita[tipo].ricavo_totale += fattura.importo;
      marginalita[tipo].numero_prestazioni += 1;
    }
  });

  // Converti in array e calcola ricavo medio
  return Object.values(marginalita).map(item => ({
    ...item,
    ricavo_medio: item.numero_prestazioni > 0 
      ? item.ricavo_totale / item.numero_prestazioni 
      : 0
  }));
}

/**
 * Wrapper per eseguire il flusso completo PKI v2:
 * 1. Ottiene istruzioni dal backend
 * 2. Scarica dati raw 
 * 3. Calcola marginalità lato client
 */
export async function eseguiMarginalitaV2(
  kpiService: any,
  anni: string[]
): Promise<{
  success: boolean;
  data: KPIMarginalita[];
  instructions?: any;
  error?: string;
}> {
  try {
    const anniParam = anni.join(',');
    console.log('PKI v2 - Anni selezionati:', anni);
    console.log('PKI v2 - Parametro anni:', anniParam);
    
    // Step 1: Ottieni istruzioni
    const instructions = await kpiService.getMarginalitaV2({ anni: anniParam });
    
    if (!instructions.success) {
      return { success: false, data: [], error: 'Errore nel recupero istruzioni v2' };
    }

    // Step 2: Scarica dati raw
    const [fattureResult, calendarResult] = await Promise.all([
      kpiService.getFattureRaw({ anni: anniParam }),
      kpiService.getCalendarRaw({ anni: anniParam })
    ]);

    if (!fattureResult.success || !calendarResult.success) {
      return { 
        success: false, 
        data: [], 
        error: 'Errore nel recupero dati raw' 
      };
    }

    // Step 3: Calcola marginalità lato client
    const marginalitaData = calcolaMarginalitaV2(
      fattureResult.data || [],
      calendarResult.data || []
    );

    return {
      success: true,
      data: marginalitaData,
      instructions: instructions.instructions
    };

  } catch (error) {
    return {
      success: false,
      data: [],
      error: `Errore PKI v2: ${error}`
    };
  }
}