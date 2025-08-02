import React from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CRow,
  CCol,
  CFormInput,
  CFormLabel,
  CFormTextarea
} from '@coreui/react';
import type { Fornitore } from '../types';

interface FornitoreDetailModalProps {
  visible: boolean;
  onClose: () => void;
  fornitore: Fornitore | null;
}

const FornitoreDetailModal: React.FC<FornitoreDetailModalProps> = ({
  visible,
  onClose,
  fornitore
}) => {
  if (!fornitore) return null;

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  };

  return (
    <CModal visible={visible} onClose={onClose} size="lg" scrollable>
      <CModalHeader>
        <CModalTitle>Dettagli Fornitore - {fornitore.nome}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow className="mb-3">
          <CCol md={6}>
            <CFormLabel htmlFor="id"><strong>ID</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="id"
              value={formatValue(fornitore.id)} 
              readOnly 
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor="nome"><strong>Nome</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="nome"
              value={formatValue(fornitore.nome)} 
              readOnly 
            />
          </CCol>
        </CRow>

        <CRow className="mb-3">
          <CCol md={6}>
            <CFormLabel htmlFor="codice_fiscale"><strong>Codice Fiscale</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="codice_fiscale"
              value={formatValue(fornitore.codice_fiscale)} 
              readOnly 
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor="partita_iva"><strong>Partita IVA</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="partita_iva"
              value={formatValue(fornitore.partita_iva)} 
              readOnly 
            />
          </CCol>
        </CRow>

        <CRow className="mb-3">
          <CCol md={12}>
            <CFormLabel htmlFor="indirizzo"><strong>Indirizzo</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="indirizzo"
              value={formatValue(fornitore.indirizzo)} 
              readOnly 
            />
          </CCol>
        </CRow>

        <CRow className="mb-3">
          <CCol md={4}>
            <CFormLabel htmlFor="citta"><strong>Città</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="citta"
              value={formatValue(fornitore.citta)} 
              readOnly 
            />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor="provincia"><strong>Provincia</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="provincia"
              value={formatValue(fornitore.provincia)} 
              readOnly 
            />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor="cap"><strong>CAP</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="cap"
              value={formatValue(fornitore.cap)} 
              readOnly 
            />
          </CCol>
        </CRow>

        <CRow className="mb-3">
          <CCol md={4}>
            <CFormLabel htmlFor="telefono"><strong>Telefono</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="telefono"
              value={formatValue(fornitore.telefono)} 
              readOnly 
            />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor="fax"><strong>Fax</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="fax"
              value={formatValue(fornitore.fax)} 
              readOnly 
            />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor="cellulare"><strong>Cellulare</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="cellulare"
              value={formatValue(fornitore.cellulare)} 
              readOnly 
            />
          </CCol>
        </CRow>

        <CRow className="mb-3">
          <CCol md={6}>
            <CFormLabel htmlFor="email"><strong>Email</strong></CFormLabel>
            <CFormInput 
              type="email" 
              id="email"
              value={formatValue(fornitore.email)} 
              readOnly 
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor="email_2"><strong>Email 2</strong></CFormLabel>
            <CFormInput 
              type="email" 
              id="email_2"
              value={formatValue(fornitore.email_2)} 
              readOnly 
            />
          </CCol>
        </CRow>

        <CRow className="mb-3">
          <CCol md={6}>
            <CFormLabel htmlFor="iban"><strong>IBAN</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="iban"
              value={formatValue(fornitore.iban)} 
              readOnly 
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor="banca"><strong>Banca</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="banca"
              value={formatValue(fornitore.banca)} 
              readOnly 
            />
          </CCol>
        </CRow>

        <CRow className="mb-3">
          <CCol md={6}>
            <CFormLabel htmlFor="sito"><strong>Sito Web</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="sito"
              value={formatValue(fornitore.sito)} 
              readOnly 
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor="contatto"><strong>Contatto</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="contatto"
              value={formatValue(fornitore.contatto)} 
              readOnly 
            />
          </CCol>
        </CRow>

        <CRow className="mb-3">
          <CCol md={6}>
            <CFormLabel htmlFor="pagamento"><strong>Pagamento</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="pagamento"
              value={formatValue(fornitore.pagamento)} 
              readOnly 
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor="nazione"><strong>Nazione</strong></CFormLabel>
            <CFormInput 
              type="text" 
              id="nazione"
              value={formatValue(fornitore.nazione)} 
              readOnly 
            />
          </CCol>
        </CRow>

        {fornitore.note && (
          <CRow className="mb-3">
            <CCol md={12}>
              <CFormLabel htmlFor="note"><strong>Note</strong></CFormLabel>
              <CFormTextarea 
                id="note"
                rows={3} 
                value={formatValue(fornitore.note)} 
                readOnly 
              />
            </CCol>
          </CRow>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default FornitoreDetailModal;