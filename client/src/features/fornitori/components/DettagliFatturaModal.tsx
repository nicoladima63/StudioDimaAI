import React from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
} from '@coreui/react';
import DettagliFattura from '../../spese/components/DettagliFattura';
import type { FatturaFornitore } from '../types';

interface DettagliFatturaModalProps {
  visible: boolean;
  onClose: () => void;
  fattura: FatturaFornitore | null;
}

const DettagliFatturaModal: React.FC<DettagliFatturaModalProps> = ({
  visible,
  onClose,
  fattura
}) => {
  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0,00 €';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  if (!fattura) return null;

  return (
    <CModal visible={visible} onClose={onClose} size="xl" scrollable>
      <CModalHeader>
        <CModalTitle>
          Dettagli Fattura {fattura.id}
          <span className="text-muted ms-2">- {fattura.codice_fornitore}</span>
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        {/* Informazioni fattura */}
        <div className="row mb-3">
          <div className="col-md-3">
            <strong>ID Fattura:</strong><br />
            <span className="text-muted">{fattura.id}</span>
          </div>
          <div className="col-md-3">
            <strong>Data Spesa:</strong><br />
            <span className="text-muted">{formatDate(fattura.data_spesa)}</span>
          </div>
          <div className="col-md-3">
            <strong>Numero Documento:</strong><br />
            <span className="text-muted">{fattura.numero_documento || '-'}</span>
          </div>
          <div className="col-md-3">
            <strong>Totale Fattura:</strong><br />
            <span className="fw-bold text-primary">
              {formatCurrency((fattura.costo_netto || 0) + (fattura.costo_iva || 0))}
            </span>
          </div>
        </div>

        {fattura.descrizione && (
          <div className="row mb-3">
            <div className="col-12">
              <strong>Descrizione:</strong><br />
              <span className="text-muted">{fattura.descrizione}</span>
            </div>
          </div>
        )}

        <div className="row mb-3">
          <div className="col-md-4">
            <strong>Costo Netto:</strong><br />
            <span className="text-muted">{formatCurrency(fattura.costo_netto || 0)}</span>
          </div>
          <div className="col-md-4">
            <strong>Costo IVA:</strong><br />
            <span className="text-muted">{formatCurrency(fattura.costo_iva || 0)}</span>
          </div>
          <div className="col-md-4">
            <strong>Fornitore:</strong><br />
            <span className="text-muted">
              {fattura.codice_fornitore}
            </span>
          </div>
        </div>

        {fattura.note && (
          <div className="row mb-3">
            <div className="col-12">
              <strong>Note:</strong><br />
              <span className="text-muted">{fattura.note}</span>
            </div>
          </div>
        )}

        <hr />

        {/* Dettagli articoli fattura */}
        <DettagliFattura fatturaId={fattura.id} />
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default DettagliFatturaModal;