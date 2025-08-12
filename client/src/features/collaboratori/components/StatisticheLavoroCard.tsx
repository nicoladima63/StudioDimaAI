import React, { useState, useEffect } from 'react';
import {
  CSpinner,
  CAlert,
  CBadge,
  CRow,
  CCol
} from '@coreui/react';
import {fornitoriService} from '../../fornitori/services/fornitori.service';
import type { StatisticheLavoroCollaboratore } from '../utils/statisticheCollaboratori';
import { calcolaStatisticheLavoro, formatCurrency, formatDate } from '../utils/statisticheCollaboratori';

interface Props {
  collaboratore: {
    codice_fornitore: string;
    nome: string;
  };
  compact?: boolean;
}

const StatisticheLavoroCard: React.FC<Props> = ({ collaboratore, compact = false }) => {
  const [statistiche, setStatistiche] = useState<StatisticheLavoroCollaboratore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    caricaStatisticheLavoro();
  }, [collaboratore.codice_fornitore]);

  const caricaStatisticheLavoro = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Recupera tutte le fatture senza paginazione (limit alto)
      const response = await fornitoriService.getFattureFornitore(
        collaboratore.codice_fornitore, 
        1, 
        1000
      );
      
      const stats = calcolaStatisticheLavoro(response.fatture);
      setStatistiche(stats);
      
    } catch (err: any) {
      setError('Errore caricamento dati');
      console.error('Errore statistiche collaboratore:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-2">
        <CSpinner size="sm" /> Caricamento dati lavoro...
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

  if (!statistiche) return null;

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
        <CCol xs={6}>
          <div className="border-start border-2 border-success ps-2">
            <div className="text-medium-emphasis small">Totale Fatturato</div>
            <div className="fw-semibold">{formatCurrency(statistiche.totale_fatturato)}</div>
          </div>
        </CCol>
        <CCol xs={6}>
          <div className="border-start border-2 border-info ps-2">
            <div className="text-medium-emphasis small">N. Fatture</div>
            <div className="fw-semibold">{statistiche.numero_fatture}</div>
          </div>
        </CCol>
      </CRow>
      
      <CRow className="g-2 mt-2">
        <CCol xs={6}>
          <div className="border-start border-2 border-warning ps-2">
            <div className="text-medium-emphasis small">Media Fattura</div>
            <div className="fw-semibold">{formatCurrency(statistiche.media_fattura)}</div>
          </div>
        </CCol>
        <CCol xs={6}>
          <div className="border-start border-2 border-primary ps-2">
            <div className="text-medium-emphasis small">Ultimo Lavoro</div>
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

export default StatisticheLavoroCard;