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

export interface FatturaDetail {
  id: string;
  data_spesa?: string; // Per fornitori
  data_fattura?: string; // Per pazienti
  numero_documento?: string;
  costo_netto?: number;
  costo_iva?: number;
  totale?: number;
  descrizione?: string;
  note?: string;
  codice_fornitore?: string; // Per fatture acquisto
  codice_paziente?: string; // Per fatture vendita
  nome_fornitore?: string;
  nome_paziente?: string;
}

export interface DettaglioRigaFattura {
  id?: string;
  codice_articolo?: string;
  descrizione?: string;
  quantita?: number;
  prezzo_unitario?: number;
  sconto?: number;
  aliquota_iva?: number;
  totale_riga?: number;
}

export interface ModalFatturaDetailProps {
  visible: boolean;
  onClose: () => void;
  fatturaId: string | null;
  entitaType: 'fornitore' | 'paziente';
  onFetchFatturaDetail: (fatturaId: string) => Promise<FatturaDetail>;
  onFetchDettagliRighe: (fatturaId: string) => Promise<DettaglioRigaFattura[]>;
  size?: 'sm' | 'lg' | 'xl';
}

const ModalFatturaDetail: React.FC<ModalFatturaDetailProps> = ({
  visible,
  onClose,
  fatturaId,
  entitaType,
  onFetchFatturaDetail,
  onFetchDettagliRighe,
  size = 'xl'
}) => {
  const [fattura, setFattura] = useState<FatturaDetail | null>(null);
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
      
      // Carica in parallelo fattura e dettagli righe
      const [fatturaData, righeData] = await Promise.all([
        onFetchFatturaDetail(fatturaId),
        onFetchDettagliRighe(fatturaId)
      ]);
      
      setFattura(fatturaData);
      setRighe(righeData);
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

  const getDataLabel = () => {
    return entitaType === 'fornitore' ? 'Data Spesa' : 'Data Fattura';
  };

  const getDataValue = () => {
    if (!fattura) return '-';
    return entitaType === 'fornitore' ? fattura.data_spesa : fattura.data_fattura;
  };

  const getEntitaInfo = () => {
    if (!fattura) return { label: '', value: '' };
    
    if (entitaType === 'fornitore') {
      return {
        label: 'Fornitore',
        value: fattura.nome_fornitore || fattura.codice_fornitore || '-'
      };
    } else {
      return {
        label: 'Paziente', 
        value: fattura.nome_paziente || fattura.codice_paziente || '-'
      };
    }
  };

  const getTotaleRighe = () => {
    return righe.reduce((sum, riga) => sum + (riga.totale_riga || 0), 0);
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
              - {getEntitaInfo().value}
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
                  <label className="text-muted small fw-bold">{getDataLabel()}:</label>
                  <div className="fw-bold">{formatDate(getDataValue())}</div>
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
                    {formatCurrency((fattura.costo_netto || 0) + (fattura.costo_iva || 0))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sezione informazioni aggiuntive */}
            <div className="row mb-4">
              <div className="col-md-3">
                <div className="info-box">
                  <label className="text-muted small fw-bold">Costo Netto:</label>
                  <div>{formatCurrency(fattura.costo_netto || 0)}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="info-box">
                  <label className="text-muted small fw-bold">Costo IVA:</label>
                  <div>{formatCurrency(fattura.costo_iva || 0)}</div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="info-box">
                  <label className="text-muted small fw-bold">{getEntitaInfo().label}:</label>
                  <div>{getEntitaInfo().value}</div>
                </div>
              </div>
            </div>

            {(fattura.descrizione || fattura.note) && (
              <div className="row mb-4">
                {fattura.descrizione && (
                  <div className="col-12 mb-2">
                    <div className="info-box">
                      <label className="text-muted small fw-bold">Descrizione:</label>
                      <div>{fattura.descrizione}</div>
                    </div>
                  </div>
                )}
                {fattura.note && (
                  <div className="col-12">
                    <div className="info-box">
                      <label className="text-muted small fw-bold">Note:</label>
                      <div>{fattura.note}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <hr className="my-4" />

            {/* Tabella dettagli righe fattura */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                <CIcon icon={cilInfo} className="me-2" />
                Dettagli Fattura {fatturaId}
              </h6>
              {righe.length > 0 && (
                <CBadge color="primary">
                  {righe.length} righe - Totale: {formatCurrency(getTotaleRighe())}
                </CBadge>
              )}
            </div>

            {righe.length > 0 ? (
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
                  {righe.map((riga, index) => (
                    <CTableRow key={index}>
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