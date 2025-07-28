import React, { useState, useEffect } from 'react';
import {
  CContainer, CRow, CCol, CCard, CCardHeader, CCardBody,
  CButton, CTable, CTableHead, CTableRow, CTableHeaderCell,
  CTableBody, CTableDataCell, CBadge, CModal, CModalHeader,
  CModalTitle, CModalBody, CModalFooter, CForm, CFormInput,
  CFormSelect, CFormTextarea, CAlert
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPencil, cilTrash, cilCopy } from '@coreui/icons';
import { protocolliService } from '../api/services/protocolli.service';
import type { Diagnosi, ProtocolloTerapeutico } from '../api/services/protocolli.service';

const Protocolli: React.FC = () => {
  const [diagnosi, setDiagnosi] = useState<Diagnosi[]>([]);
  const [protocolli, setProtocolli] = useState<ProtocolloTerapeutico[]>([]);
  const [selectedDiagnosi, setSelectedDiagnosi] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'diagnosi' | 'protocollo'>('diagnosi');
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    loadDiagnosi();
  }, []);

  const loadDiagnosi = async () => {
    try {
      setLoading(true);
      const data = await protocolliService.getDiagnosi();
      setDiagnosi(data);
    } catch (err) {
      setError('Errore nel caricamento delle diagnosi');
    } finally {
      setLoading(false);
    }
  };

  const loadProtocolli = async (diagnosiId: number) => {
    try {
      setLoading(true);
      const data = await protocolliService.getProtocolliPerDiagnosi(diagnosiId);
      setProtocolli(data);
      setSelectedDiagnosi(diagnosiId);
    } catch (err) {
      setError('Errore nel caricamento dei protocolli');
    } finally {
      setLoading(false);
    }
  };

  const duplicateDiagnosi = async (diagnosiId: number) => {
    try {
      const originalDiagnosi = diagnosi.find(d => d.id === diagnosiId);
      if (originalDiagnosi) {
        await protocolliService.duplicateDiagnosi(diagnosiId, {
          new_codice: `${originalDiagnosi.codice}_copy`,
          new_descrizione: `${originalDiagnosi.descrizione} (Copia)`,
          new_categoria: originalDiagnosi.categoria
        });
        loadDiagnosi();
      }
    } catch (err) {
      setError('Errore nella duplicazione');
    }
  };

  return (
    <CContainer fluid>
      <CRow>
        <CCol md={4}>
          <CCard>
            <CCardHeader>
              <h5>Diagnosi</h5>
              <CButton color="primary" size="sm" onClick={() => {setModalType('diagnosi'); setShowModal(true)}}>
                <CIcon icon={cilPlus} /> Nuova
              </CButton>
            </CCardHeader>
            <CCardBody>
              {error && <CAlert color="danger">{error}</CAlert>}
              <CTable hover>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Codice</CTableHeaderCell>
                    <CTableHeaderCell>Descrizione</CTableHeaderCell>
                    <CTableHeaderCell>Protocolli</CTableHeaderCell>
                    <CTableHeaderCell>Azioni</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {diagnosi.map((d) => (
                    <CTableRow key={d.id} style={{cursor: 'pointer'}} onClick={() => loadProtocolli(d.id)}>
                      <CTableDataCell>{d.codice}</CTableDataCell>
                      <CTableDataCell>{d.descrizione}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="info">{d.num_farmaci || 0}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CButton size="sm" color="secondary" onClick={(e) => {e.stopPropagation(); duplicateDiagnosi(d.id)}}>
                          <CIcon icon={cilCopy} />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
        
        <CCol md={8}>
          <CCard>
            <CCardHeader>
              <h5>Protocolli Terapeutici</h5>
              {selectedDiagnosi && (
                <CButton color="success" size="sm" onClick={() => {setModalType('protocollo'); setShowModal(true)}}>
                  <CIcon icon={cilPlus} /> Nuovo Protocollo
                </CButton>
              )}
            </CCardHeader>
            <CCardBody>
              {selectedDiagnosi ? (
                <CTable>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Farmaco</CTableHeaderCell>
                      <CTableHeaderCell>Posologia</CTableHeaderCell>
                      <CTableHeaderCell>Durata</CTableHeaderCell>
                      <CTableHeaderCell>Note</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {protocolli.map((p) => (
                      <CTableRow key={p.protocollo_id}>
                        <CTableDataCell>
                          <strong>{p.principio_attivo}</strong><br/>
                          <small>{p.nomi_commerciali}</small>
                        </CTableDataCell>
                        <CTableDataCell>{p.posologia_custom || p.posologia_standard}</CTableDataCell>
                        <CTableDataCell>{p.durata_custom}</CTableDataCell>
                        <CTableDataCell>{p.note_custom}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              ) : (
                <p>Seleziona una diagnosi per visualizzare i protocolli</p>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  );
};

export default Protocolli;