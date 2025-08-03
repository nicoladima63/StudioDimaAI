import React from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CBadge,
  CProgress,
  CAlert,
  CListGroup,
  CListGroupItem
} from '@coreui/react';
import { CIcon } from '@coreui/icons-react';
import {
  cilChart,
  cilInfo,
  cilLightbulb,
  cilCheckCircle
} from '@coreui/icons';
import type { SpesaFornitore } from '@/features/spese/types';
import {
  useAutoCategorization,
  useStatisticheCategorizzazione,
  useSuggerimentiCategorizzazione
} from '../hooks/useAutoCategorization';

interface StatisticheCategorizzazioneProps {
  spese: SpesaFornitore[];
  className?: string;
}

const StatisticheCategorizzazione: React.FC<StatisticheCategorizzazioneProps> = ({
  spese,
  className
}) => {
  const { getCategoriaColor } = useAutoCategorization();
  const statistiche = useStatisticheCategorizzazione(spese);
  const suggerimenti = useSuggerimentiCategorizzazione(spese);

  const getConfidenceColorClass = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.5) return 'warning';
    return 'danger';
  };

  return (
    <CRow className={className}>
      {/* Panoramica generale */}
      <CCol lg={12} className="mb-4">
        <CCard>
          <CCardHeader>
            <div className="d-flex align-items-center">
              <CIcon icon={cilChart} className="me-2" />
              <strong>Statistiche Auto-Categorizzazione</strong>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow>
              <CCol md={3}>
                <div className="text-center">
                  <div className="fs-2 fw-semibold text-primary">
                    {statistiche.totaleSpese}
                  </div>
                  <div className="text-uppercase text-medium-emphasis small">
                    Totale Spese
                  </div>
                </div>
              </CCol>
              <CCol md={3}>
                <div className="text-center">
                  <div className="fs-2 fw-semibold text-success">
                    {statistiche.speseRiconosciute}
                  </div>
                  <div className="text-uppercase text-medium-emphasis small">
                    Riconosciute
                  </div>
                </div>
              </CCol>
              <CCol md={3}>
                <div className="text-center">
                  <div className="fs-2 fw-semibold text-info">
                    {statistiche.percentualeRiconoscimento}%
                  </div>
                  <div className="text-uppercase text-medium-emphasis small">
                    Tasso Riconoscimento
                  </div>
                </div>
              </CCol>
              <CCol md={3}>
                <div className="text-center">
                  <div className="fs-2 fw-semibold text-warning">
                    {statistiche.dettagliCategorie.length}
                  </div>
                  <div className="text-uppercase text-medium-emphasis small">
                    Categorie Attive
                  </div>
                </div>
              </CCol>
            </CRow>
            
            <div className="mt-3">
              <div className="small text-medium-emphasis mb-1">
                Progresso categorizzazione
              </div>
              <CProgress 
                height={8}
                value={statistiche.percentualeRiconoscimento}
                color={statistiche.percentualeRiconoscimento >= 80 ? 'success' : 
                       statistiche.percentualeRiconoscimento >= 50 ? 'warning' : 'danger'}
              />
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      {/* Dettagli categorie */}
      <CCol lg={8}>
        <CCard>
          <CCardHeader>
            <strong>Distribuzione per Categoria</strong>
          </CCardHeader>
          <CCardBody>
            {statistiche.dettagliCategorie.length > 0 ? (
              <CListGroup flush>
                {statistiche.dettagliCategorie.map((categoria) => (
                  <CListGroupItem 
                    key={categoria.categoria}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <div className="d-flex align-items-center">
                      <CBadge 
                        color={getCategoriaColor(categoria.categoria)}
                        className="me-2"
                      >
                        {categoria.label}
                      </CBadge>
                      <span className="small text-medium-emphasis">
                        Confidence: {categoria.confidenceMedia}
                      </span>
                    </div>
                    <div className="d-flex align-items-center">
                      <span className="me-3">
                        {categoria.count} spese ({categoria.percentuale}%)
                      </span>
                      <div style={{ width: '100px' }}>
                        <CProgress 
                          height={6}
                          value={categoria.percentuale}
                          color={getConfidenceColorClass(categoria.confidenceMedia)}
                        />
                      </div>
                    </div>
                  </CListGroupItem>
                ))}
              </CListGroup>
            ) : (
              <CAlert color="info" className="mb-0">
                <CIcon icon={cilInfo} className="me-2" />
                Nessuna categoria rilevata. Carica delle spese per vedere le statistiche.
              </CAlert>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      {/* Suggerimenti miglioramento */}
      <CCol lg={4}>
        <CCard>
          <CCardHeader>
            <div className="d-flex align-items-center">
              <CIcon icon={cilLightbulb} className="me-2" />
              <strong>Suggerimenti</strong>
            </div>
          </CCardHeader>
          <CCardBody>
            {suggerimenti.length > 0 ? (
              <div>
                <div className="small text-medium-emphasis mb-3">
                  Consigli per migliorare la categorizzazione automatica:
                </div>
                {suggerimenti.map((suggerimento, index) => (
                  <CAlert key={index} color="light" className="small mb-2">
                    {suggerimento}
                  </CAlert>
                ))}
              </div>
            ) : (
              <CAlert color="success" className="mb-0">
                <CIcon icon={cilCheckCircle} className="me-2" />
                Ottima categorizzazione! Tutte le spese sono state riconosciute correttamente.
              </CAlert>
            )}
            
            {/* Link utili */}
            <div className="mt-3 pt-3 border-top">
              <div className="small text-medium-emphasis mb-2">
                Azioni utili:
              </div>
              <div className="d-grid gap-2">
                <button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    // TODO: implementare esportazione
                    console.log('Esporta categorizzazioni');
                  }}
                >
                  Esporta Categorizzazioni
                </button>
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    // TODO: implementare revisione manuale
                    console.log('Revisione manuale');
                  }}
                >
                  Revisione Manuale
                </button>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default StatisticheCategorizzazione;