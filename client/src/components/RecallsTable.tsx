import React, { useState, useMemo } from 'react';
import { 
  CTable, 
  CTableHead, 
  CTableRow, 
  CTableHeaderCell, 
  CTableBody, 
  CTableDataCell,
  CBadge,
  CButton,
  CInputGroup,
  CFormInput,
  CFormSelect,
  CSpinner,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CRow,
  CCol
} from '@coreui/react';
import { cilPhone, cilEnvelopeClosed, cilCheck, cilInfo } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import type { Richiamo, RichiamoMessage } from '@/api/apiTypes';

// Mappa colori tipo richiamo (usando COLORI_APPUNTAMENTO)
const COLORI_RICHIAMI: Record<string, string> = {
  'Generico': '#008000', // verde
  'Igiene': '#800080',   // violetto
  'Impianto': '#00BFFF', // indaco
  'Ortodonzia': '#FFC0CB', // rosa
  'Rx Impianto': '#FFFF00', // giallo
  'Controllo': '#ADD8E6', // azzurro
};

const getTipoColor = (tipo: string) => COLORI_RICHIAMI[tipo] || '#888';

interface RecallsTableProps {
  richiami: Richiamo[];
  loading?: boolean;
  onSendSMS?: (richiamo: Richiamo) => void;
  onViewMessage?: (richiamoId: string) => void;
  onMarkHandled?: (richiamoId: string) => void;
}

const PAGE_SIZE_OPTIONS = [5, 10, 30, 50, 100];

const RecallsTable: React.FC<RecallsTableProps> = ({
  richiami,
  loading = false,
  onSendSMS,
  onViewMessage,
  onMarkHandled
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRichiamo, setSelectedRichiamo] = useState<RichiamoMessage | null>(null);
  const [selectedRichiamoObj, setSelectedRichiamoObj] = useState<Richiamo | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'paziente' | 'ogni_quanto' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const getStatusBadge = (stato: string) => {
    switch (stato) {
      case 'scaduto':
        return <CBadge color="danger">Scaduto</CBadge>;
      case 'in_scadenza':
        return <CBadge color="warning">In Scadenza</CBadge>;
      case 'futuro':
        return <CBadge color="success">Futuro</CBadge>;
      default:
        return <CBadge color="secondary">Sconosciuto</CBadge>;
    }
  };

  const isValidDate = (d: unknown) => {
    return d instanceof Date && !isNaN((d as Date).getTime());
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === 'Non disponibile') return '-';
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // ISO string
      return new Date(dateString).toLocaleDateString('it-IT');
    }
    if (isValidDate(dateString)) {
      return (dateString as unknown as Date).toLocaleDateString('it-IT');
    }
    try {
      return new Date(dateString as string).toLocaleDateString('it-IT');
    } catch {
      return '-';
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    return phone;
  };

  const filteredRichiami = richiami.filter(richiamo => {
    const matchesSearch = richiamo.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         richiamo.telefono.includes(searchTerm) ||
                         richiamo.tipo_descrizione.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || richiamo.stato === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedRichiami = useMemo(() => {
    const arr = [...filteredRichiami];
    if (sortBy === 'paziente') {
      arr.sort((a, b) => {
        const nA = a.nome_completo.toLowerCase();
        const nB = b.nome_completo.toLowerCase();
        return sortDir === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
      });
    } else if (sortBy === 'ogni_quanto') {
      arr.sort((a, b) => {
        const mA = a.mesi_richiamo || 0;
        const mB = b.mesi_richiamo || 0;
        return sortDir === 'asc' ? mA - mB : mB - mA;
      });
    }
    return arr;
  }, [filteredRichiami, sortBy, sortDir]);

  const paginatedRichiami = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRichiami.slice(start, start + pageSize);
  }, [sortedRichiami, page, pageSize]);

  const totalPages = Math.ceil(filteredRichiami.length / pageSize) || 1;

  const handleViewMessage = async (richiamo: Richiamo) => {
    if (onViewMessage) {
      onViewMessage(richiamo.id_paziente || '');
    }
    setSelectedRichiamo({
      paziente: richiamo.nome_completo,
      telefono: richiamo.telefono,
      messaggio: `Gentile ${richiamo.nome_completo}, la ricordiamo per il suo appuntamento di ${richiamo.tipo_descrizione}. La contatteremo presto per confermare.`,
      tipo_richiamo: richiamo.tipo_descrizione,
      data_scadenza: richiamo.data_richiamo || 'Non specificata'
    });
    setSelectedRichiamoObj(richiamo);
    setShowMessageModal(true);
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <CSpinner color="primary" />
        <p className="mt-2">Caricamento richiami...</p>
      </div>
    );
  }

  return (
    <>
      {/* Filtri e paginazione */}
      <div className="mb-3">
        <CRow>
          <CCol md={6}>
            <CInputGroup>
              <CFormInput
                placeholder="Cerca per nome, telefono o tipo..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              />
            </CInputGroup>
          </CCol>
          <CCol md={3}>
            <CFormSelect
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">Tutti gli stati</option>
              <option value="scaduto">Scaduti</option>
              <option value="in_scadenza">In Scadenza</option>
              <option value="futuro">Futuri</option>
              <option value="sconosciuto">Sconosciuto</option>
            </CFormSelect>
          </CCol>
          <CCol md={2}>
            <CFormSelect
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt} per pagina</option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={1} className="d-flex align-items-center justify-content-end">
            <small className="text-muted">
              Pagina {page} di {totalPages}
            </small>
          </CCol>
        </CRow>
      </div>

      {/* Tabella */}
      <CTable hover responsive>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (sortBy === 'paziente') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                setSortBy('paziente');
              }}
            >
              Paziente {sortBy === 'paziente' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell>Telefono</CTableHeaderCell>
            <CTableHeaderCell>Tipo Richiamo</CTableHeaderCell>
            <CTableHeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (sortBy === 'ogni_quanto') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                setSortBy('ogni_quanto');
              }}
            >
              Ogni quanto {sortBy === 'ogni_quanto' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell>Data Richiamo</CTableHeaderCell>
            <CTableHeaderCell>Stato</CTableHeaderCell>
            <CTableHeaderCell>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {paginatedRichiami.length === 0 ? (
            <CTableRow>
              <CTableDataCell colSpan={7} className="text-center py-4">
                <p className="text-muted mb-0">Nessun richiamo trovato</p>
              </CTableDataCell>
            </CTableRow>
          ) : (
            paginatedRichiami.map((richiamo, index) => (
              <CTableRow key={index}>
                <CTableDataCell>
                  <div>
                    <strong>{richiamo.nome_completo}</strong>
                    {richiamo.ultima_visita && (
                      <div className="small text-muted">
                        Ultima visita: {formatDate(richiamo.ultima_visita)}
                      </div>
                    )}
                  </div>
                </CTableDataCell>
                <CTableDataCell>
                  <div className="d-flex align-items-center">
                    <CIcon icon={cilPhone} className="me-2 text-muted" />
                    {formatPhone(richiamo.telefono)}
                  </div>
                </CTableDataCell>
                <CTableDataCell>
                  <div className="d-flex flex-wrap gap-1">
                    {richiamo.tipi_descrizione.map((tipo, i) => (
                      <span
                        key={i}
                        style={{
                          background: getTipoColor(tipo),
                          color: '#fff',
                          borderRadius: '12px',
                          padding: '2px 10px',
                          fontSize: '0.85em',
                          fontWeight: 500,
                          display: 'inline-block',
                        }}
                      >
                        {tipo}
                      </span>
                    ))}
                  </div>
                </CTableDataCell>
                <CTableDataCell>
                  {richiamo.mesi_richiamo ? `${richiamo.mesi_richiamo} mesi` : '-'}
                </CTableDataCell>
                <CTableDataCell>
                  {richiamo.data_richiamo ? (
                    <div>
                      <div>{formatDate(richiamo.data_richiamo)}</div>
                    </div>
                  ) : (
                    <span className="text-muted">Non specificata</span>
                  )}
                </CTableDataCell>
                <CTableDataCell>
                  <div className="d-flex align-items-center gap-2">
                    {getStatusBadge(richiamo.stato)}
                    {richiamo.giorni_scadenza !== null && (
                      <span className="small text-muted ms-1">{Math.abs(richiamo.giorni_scadenza)} giorni</span>
                    )}
                  </div>
                </CTableDataCell>
                <CTableDataCell>
                  <div className="btn-group" role="group">
                    <CButton
                      color="info"
                      size="sm"
                      onClick={() => handleViewMessage(richiamo)}
                      title="Visualizza messaggio"
                    >
                      <CIcon icon={cilInfo} />
                    </CButton>
                    <CButton
                      color="success"
                      size="sm"
                      onClick={() => {
                        if (selectedRichiamoObj) {
                          onSendSMS?.(selectedRichiamoObj);
                        }
                        setShowMessageModal(false);
                      }}
                      title="Invia SMS"
                    >
                      <CIcon icon={cilEnvelopeClosed} />
                    </CButton>
                    <CButton
                      color="primary"
                      size="sm"
                      onClick={() => onMarkHandled?.(richiamo.id_paziente || '')}
                      title="Marca come gestito"
                    >
                      <CIcon icon={cilCheck} />
                    </CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ))
          )}
        </CTableBody>
      </CTable>

      {/* Paginazione */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div>
          <CButton
            color="light"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            &lt; Prev
          </CButton>
          <span className="mx-2">Pagina {page} di {totalPages}</span>
          <CButton
            color="light"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next &gt;
          </CButton>
        </div>
        <div>
          <small className="text-muted">
            {filteredRichiami.length} richiami totali
          </small>
        </div>
      </div>

      {/* Modal per visualizzare il messaggio */}
      <CModal
        visible={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>Messaggio Richiamo</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedRichiamo && (
            <div>
              <div className="mb-3">
                <strong>Paziente:</strong> {selectedRichiamo.paziente}
              </div>
              <div className="mb-3">
                <strong>Telefono:</strong> {formatPhone(selectedRichiamo.telefono)}
              </div>
              <div className="mb-3">
                <strong>Tipo Richiamo:</strong> {selectedRichiamo.tipo_richiamo}
              </div>
              <div className="mb-3">
                <strong>Data Scadenza:</strong> {selectedRichiamo.data_scadenza}
              </div>
              <div className="mb-3">
                <strong>Messaggio:</strong>
                <div className="mt-2 p-3 bg-light rounded">
                  {selectedRichiamo.messaggio}
                </div>
              </div>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowMessageModal(false)}>
            Chiudi
          </CButton>
          <CButton color="success" onClick={() => {
            if (selectedRichiamoObj) {
              onSendSMS?.(selectedRichiamoObj);
            }
            setShowMessageModal(false);
          }}>
            Invia SMS
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default RecallsTable; 