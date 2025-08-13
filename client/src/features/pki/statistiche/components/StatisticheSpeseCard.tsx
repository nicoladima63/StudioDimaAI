import React, { useState, useEffect } from 'react';
import {
  CSpinner,
  CAlert,
  CBadge,
  CRow,
  CCol
} from '@coreui/react';
import {fornitoriService} from '../../../fornitori/services/fornitori.service';
import type { StatisticheSpeseFornitore } from '../utils/statisticheFornitori';
import { calcolaStatisticheSpese, formatCurrency, formatDate } from '../utils/statisticheFornitori';

interface Props {
  fornitore: {
    codice_riferimento: string;
    fornitore_nome: string;
  };
  statistiche?: StatisticheSpeseFornitore | null;
  compact?: boolean;
}

const StatisticheSpeseCard: React.FC<Props> = ({ fornitore, statistiche: statisticheProp, compact = false }) => {
  // Se abbiamo le statistiche come prop, usiamo quelle, altrimenti carichiamole
  const [statisticheLocal, setStatisticheLocal] = useState<StatisticheSpeseFornitore | null>(null);
  const [loading, setLoading] = useState(!statisticheProp);
  const [error, setError] = useState<string | null>(null);
  
  const statistiche = statisticheProp || statisticheLocal;

  useEffect(() => {
    // Se abbiamo già le statistiche come prop, usiamo quelle
    if (statisticheProp) {
      setLoading(false);
      return;
    }
    
    // 🚨 EMERGENCY STOP: Disattivato caricamento automatico per evitare loop infinito
    // TODO: Implementare caricamento centralizzato nella StatistichePage
    setLoading(false);
    
    // // DISATTIVATO TEMPORANEAMENTE
    // caricaStatisticheSpese();
  }, [fornitore.codice_riferimento, statisticheProp]);

  // DISATTIVATO: Caricamento ora centralizzato in StatistichePage  
  const caricaStatisticheSpese = async () => {
    if (statisticheProp) return; // Se abbiamo le prop, non carichiamo
    
    try {
      setLoading(true);
      setError(null);
      
      // Recupera tutte le fatture senza paginazione (limit alto)
      const response = await fornitoriService.getFattureFornitore(
        fornitore.codice_riferimento, 
        1, 
        1000
      );
      
      const stats = calcolaStatisticheSpese(response.fatture);
      setStatisticheLocal(stats);
      
    } catch (err: any) {
      setError('Errore caricamento dati');
      console.error('Errore statistiche fornitore:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-2">
        <CSpinner size="sm" /> Caricamento dati spese...
      </div>
    );
  }

  if (error) {
    return (
      <CAlert color="warning" className="py-1 px-2 small">
        {error}
      </CAlert>
    );
  }

  if (!statistiche) {
    // 🚨 EMERGENCY: Mostra skeleton anche quando non ci sono dati
    return (
      <div className="text-center py-2">
        <div className="text-muted small">Statistiche non disponibili</div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="small text-muted">
        <div><strong>Fatturato:</strong> {formatCurrency(statistiche.totale_fatturato)}</div>
        <div><strong>Fatture:</strong> {statistiche.numero_fatture}</div>
        <div><strong>Ultimo lavoro:</strong> {formatDate(statistiche.ultimo_lavoro)}</div>
      </div>
    );
  }

  return (
    <div>
      <CRow className="g-2">
        <CCol xs={12}>
          <div className="border-start border-2 border-success ps-2 mb-2">
            <div className="text-medium-emphasis small">Totale Fatturato</div>
            <div className="fw-semibold">{formatCurrency(statistiche.totale_fatturato)}</div>
          </div>
        </CCol>
        <CCol xs={4}>
          <div className="border-start border-2 border-info ps-2">
            <div className="text-medium-emphasis small">N. Fatture</div>
            <div className="fw-semibold">{statistiche.numero_fatture}</div>
          </div>
        </CCol>
        <CCol xs={4}>
          <div className="border-start border-2 border-warning ps-2">
            <div className="text-medium-emphasis small">Media</div>
            <div className="fw-semibold">{formatCurrency(statistiche.media_fattura)}</div>
          </div>
        </CCol>
        <CCol xs={4}>
          <div className="border-start border-2 border-warning ps-2">
            <div className="text-medium-emphasis small">Ultima fattura</div>
            <div className="fw-semibold small">{formatDate(statistiche.ultimo_lavoro)}</div>
            </div>
        </CCol>
        
      </CRow>

      {statistiche.totali_mensili.length > 0 && (
        <div className="mt-3">
          <div className="text-medium-emphasis small mb-2">Ultimi 3 mesi:</div>
          <div className="d-flex flex-wrap gap-1">
            {statistiche.totali_mensili.slice(-3).map(mese => (
              <CBadge 
                key={mese.mese} 
                color="secondary" 
                className="small"
              >
                {mese.mese}: {formatCurrency(mese.totale)}
              </CBadge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticheSpeseCard;