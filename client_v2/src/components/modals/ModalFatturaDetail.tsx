import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CAlert,
  CSpinner,
  CBadge
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilX, cilDescription, cilInfo } from '@coreui/icons';
import './modals.css';

import type { FatturaCompleta, FatturaIntestazione, DettaglioRigaFattura } from '@/types/fatture';

export interface ModalFatturaDetailProps {
  visible: boolean;
  onClose: () => void;
  fatturaId: string | null;
  materialeId?: number | null;
  onFetchFatturaCompleta: (fatturaId: string) => Promise<FatturaCompleta>;
  size?: 'sm' | 'lg' | 'xl';
}

const ModalFatturaDetail: React.FC<ModalFatturaDetailProps> = ({
  visible,
  onClose,
  fatturaId,
  materialeId,
  onFetchFatturaCompleta,
  size = 'xl'
}) => {
  const [fattura, setFattura] = useState<FatturaIntestazione | null>(null);
  const [righe, setRighe] = useState<DettaglioRigaFattura[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carica dettagli quando la modal si apre
  useEffect(() => {
    if (visible && fatturaId) {
      fetchFatturaDetail();
    } else {
      // Reset quando si chiude
      resetState();
    }
  }, [visible, fatturaId]);

  const resetState = () => {
    setFattura(null);
    setRighe([]);
    setError(null);
  };

  const fetchFatturaDetail = async () => {
    if (!fatturaId) return;

    try {
      setLoading(true);
      setError(null);
      
      const fatturaCompleta = await onFetchFatturaCompleta(fatturaId);
      
      setFattura(fatturaCompleta.intestazione);
      setRighe(fatturaCompleta.dettagli);
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento del dettaglio fattura');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value && value !== 0) return '0,00 €';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  const getTotaleRighe = () => {
    return righe.reduce((sum, riga) => sum + (riga.totale_riga || 0), 0);
  };

  // Filtra le righe per mostrare solo quelle con quantità e prezzo maggiori di zero
  const getRigheFiltrate = () => {
    const filtrate = righe.filter(riga => {
      const quantita = riga.quantita || 0;
      const prezzo = riga.prezzo_unitario || 0;
      // Mostra solo le righe con quantità E prezzo maggiori di zero
      return quantita > 0 && prezzo > 0;
    });
    console.warn('Righe totali:', righe.length, 'Righe filtrate:', filtrate.length);
    return filtrate;
  };

  if (!fatturaId) return null;

  return (
    <CModal visible={visible} onClose={onClose} size={size} scrollable className="modal-fattura-detail">
      <CModalHeader>
        <CModalTitle>
          <CIcon icon={cilDescription} className="me-2" />
          Dettagli Fattura {fatturaId}
          {fattura && (
            <span className="text-muted ms-2">
              - {fattura.fornitorenome}
            </span>
          )}
        </CModalTitle>
      </CModalHeader>
      
      <CModalBody>
        {loading && (
          <div className="text-center p-4">
            <CSpinner color="primary" />
            <p className="mt-2 mb-0">Caricamento dettagli fattura...</p>
          </div>
        )}

        {error && (
          <CAlert color="danger" dismissible>
            {error}
            <CButton 
              color="danger" 
              variant="outline" 
              size="sm" 
              className="ms-2" 
              onClick={fetchFatturaDetail}
            >
              Riprova
            </CButton>
          </CAlert>
        )}

        {!loading && !error && fattura && (
          <>
            {/* Header informazioni fattura - Layout come step-3 */}
            <div className="row mb-4">
              <div className="col-md-3">
                <div className="info-box">
                  <label className="text-muted small fw-bold">ID Fattura:</label>
                  <div className="fw-bold">{fattura.id}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="info-box">
                  <label className="text-muted small fw-bold">Data Spesa:</label>
                  <div className="fw-bold">{formatDate(fattura.data_spesa)}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="info-box">
                  <label className="text-muted small fw-bold">Numero Documento:</label>
                  <div className="fw-bold">{fattura.numero_documento || '-'}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="info-box">
                  <label className="text-muted small fw-bold">Totale Fattura:</label>
                  <div className="fw-bold text-primary fs-5">
                    {formatCurrency(fattura.costo_totale)}
                  </div>
                </div>
              </div>
            </div>

            {/* Sezione informazioni aggiuntive */}
            <div className="row mb-4">
              <div className="col-md-3">
                <div className="info-box">
                  <label className="text-muted small fw-bold">Costo Netto:</label>
                  <div>{formatCurrency(fattura.costo_netto_totale)}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="info-box">
                  <label className="text-muted small fw-bold">Costo IVA:</label>
                  <div>{formatCurrency(fattura.costo_iva_totale)}</div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="info-box">
                  <label className="text-muted small fw-bold">Fornitore:</label>
                  <div>{fattura.fornitorenome}</div>
                </div>
              </div>
            </div>

            <hr className="my-4" />

            {/* Tabella dettagli righe fattura */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                <CIcon icon={cilInfo} className="me-2" />
                Dettagli Fattura {fatturaId}
              </h6>
              {righe.length > 0 && (
                <CBadge color="primary">
                  {getRigheFiltrate().length} righe (da {righe.length} totali) - Totale: {formatCurrency(getTotaleRighe())}
                </CBadge>
              )}
            </div>

            {getRigheFiltrate().length > 0 ? (
              <CTable striped hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Cod. Art.</CTableHeaderCell>
                    <CTableHeaderCell>Descrizione</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">Qtà</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Prezzo Unit.</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">Sconto %</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">IVA %</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Totale Riga</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {getRigheFiltrate().map((riga, index) => (
                    <CTableRow 
                      key={index}
                      className={riga.id === materialeId ? 'table-row-highlight' : ''}
                    >
                      <CTableDataCell>
                        <code className="text-muted small">
                          {riga.codice_articolo || '-'}
                        </code>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="text-wrap">
                          {riga.descrizione || '-'}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        {riga.quantita || 0}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">
                        {formatCurrency(riga.prezzo_unitario)}
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        {riga.sconto || 0}%
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        {riga.aliquota_iva || 0}%
                      </CTableDataCell>
                      <CTableDataCell className="text-end">
                        <strong>{formatCurrency(riga.totale_riga)}</strong>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            ) : (
              <div className="text-center text-muted py-4">
                <CIcon icon={cilInfo} size="2xl" className="mb-3" />
                <p className="mb-0">Nessun dettaglio disponibile per questa fattura</p>
              </div>
            )}
          </>
        )}
      </CModalBody>
      
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          <CIcon icon={cilX} size="sm" className="me-1" />
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default ModalFatturaDetail;