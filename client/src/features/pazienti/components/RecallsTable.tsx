// src/features/pazienti/components/RecallsTable.tsx

import React, { useState, useMemo } from 'react';
import {
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CButton, CFormInput, CFormSelect, CRow, CCol, CBadge, CButtonGroup, CFormCheck, CDropdown, CDropdownToggle, CDropdownMenu, CDropdownItem, CToaster, CToast, CToastBody, CTooltip, CSpinner, CInputGroup, CInputGroupText
} from '@coreui/react';
import { cilCheck, cilEnvelopeClosed, cilInfo, cilSearch, cilLocationPin, cilFilter, cilReload, cilCloudDownload } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { useSMSStore } from '@/store/smsStore';
import SMSPreviewModal from '@/components/ui/SMSPreviewModal';
import type { PazienteCompleto } from '@/lib/types';
import type { SMSResponse } from '@/api/services/sms.service';

interface RecallsTableProps {
  richiami: PazienteCompleto[];
  loading: boolean;
  selectedPatients: Set<string>;
  setSelectedPatients: (s: Set<string>) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const RecallsTable: React.FC<RecallsTableProps> = ({ richiami, loading, selectedPatients, setSelectedPatients }) => {
  // Ricerca, ordinamento, paginazione
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'nome' | 'citta' | 'priorita' | 'stato'>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Filtro richiami in base alla ricerca
  const filteredRichiami = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return richiami.filter(r =>
      (r.nome_completo || '').toLowerCase().includes(term) ||
      (r.citta_clean || '').toLowerCase().includes(term) ||
      (r.numero_contatto || '').includes(term)
    );
  }, [richiami, searchTerm]);

  // Ordinamento
  const sortedRichiami = useMemo(() => {
    const arr = [...filteredRichiami];
    if (sortBy === 'nome') {
      arr.sort((a, b) => {
        const nA = a.nome_completo.toLowerCase();
        const nB = b.nome_completo.toLowerCase();
        return sortDir === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
      });
    } else if (sortBy === 'citta') {
      arr.sort((a, b) => {
        const cA = (a.citta_clean || '').toLowerCase();
        const cB = (b.citta_clean || '').toLowerCase();
        return sortDir === 'asc' ? cA.localeCompare(cB) : cB.localeCompare(cA);
      });
    } else if (sortBy === 'priorita') {
      arr.sort((a, b) => {
        const pA = a.recall_priority || '';
        const pB = b.recall_priority || '';
        return sortDir === 'asc' ? pA.localeCompare(pB) : pB.localeCompare(pA);
      });
    } else if (sortBy === 'stato') {
      arr.sort((a, b) => {
        const sA = a.recall_status || '';
        const sB = b.recall_status || '';
        return sortDir === 'asc' ? sA.localeCompare(sB) : sB.localeCompare(sA);
      });
    }
    return arr;
  }, [filteredRichiami, sortBy, sortDir]);

  // Paginazione
  const paginatedRichiami = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRichiami.slice(start, start + pageSize);
  }, [sortedRichiami, page, pageSize]);

  const totalPages = Math.ceil(filteredRichiami.length / pageSize) || 1;

  // Gestione cambio ordinamento
  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  // SMS Store
  const { mode: smsMode, isEnabled: isSMSEnabled, canSendSMS } = useSMSStore();

  // Modal state
  const [smsModalVisible, setSmsModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PazienteCompleto | null>(null);

  // Bulk selection state
  const [bulkLoading, setBulkLoading] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<Array<{
    id: string;
    message: string;
    color: 'success' | 'danger' | 'warning';
  }>>([]);

  // Handle single SMS
  const handleSendSMS = (paziente: PazienteCompleto) => {
    setSelectedPatient(paziente);
    setSmsModalVisible(true);
  };

  // Handle SMS sent callback
  const handleSMSSent = (result: SMSResponse) => {
    if (result.success) {
      addToast(`✅ SMS inviato a ${selectedPatient?.nome_completo}`, 'success');
    } else {
      addToast(`❌ Errore invio SMS: ${result.error}`, 'danger');
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allWithPhone = richiami
        .filter(r => r.numero_contatto)
        .map(r => r.DB_CODE);
      setSelectedPatients(new Set(allWithPhone));
    } else {
      setSelectedPatients(new Set());
    }
  };

  const handleSelectPatient = (dbCode: string, checked: boolean) => {
    const newSelection = new Set(selectedPatients);
    if (checked) {
      newSelection.add(dbCode);
    } else {
      newSelection.delete(dbCode);
    }
    setSelectedPatients(newSelection);
  };

  // Bulk SMS handler
  const handleBulkSMS = async () => {
    if (selectedPatients.size === 0) return;

    const confirmed = confirm(
      `Inviare SMS di richiamo a ${selectedPatients.size} pazienti selezionati?`
    );

    if (!confirmed) return;

    try {
      setBulkLoading(true);
      
      const selectedData = richiami.filter(r => selectedPatients.has(r.DB_CODE));
      
      // Prepare bulk SMS data
      const bulkData = selectedData.map(paziente => ({
        telefono: paziente.numero_contatto!,
        nome_completo: paziente.nome_completo,
        tipo_richiamo: paziente.tipo_richiamo_desc || 'Controllo',
        data_richiamo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT')
      }));

      // Send bulk SMS
      const response = await apiClient.post('/api/sms/send-bulk', { richiami: bulkData });
      const result = response.data;

      if (result.success) {
        addToast(
          `📤 SMS inviati: ${result.summary.success} successi, ${result.summary.errors} errori`,
          result.summary.errors > 0 ? 'warning' : 'success'
        );
        setSelectedPatients(new Set()); // Clear selection
      } else {
        throw new Error(result.error || 'Errore invio bulk SMS');
      }

    } catch (error) {
      console.error('Errore bulk SMS:', error);
      addToast('❌ Errore invio SMS multipli', 'danger');
    } finally {
      setBulkLoading(false);
    }
  };

  // Toast helper
  const addToast = (message: string, color: 'success' | 'danger' | 'warning') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, color }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Helper functions
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scaduto': return 'danger';
      case 'in_scadenza': return 'warning';
      case 'futuro': return 'success';
      default: return 'secondary';
    }
  };

  const canSendSMSToPatient = (paziente: PazienteCompleto) => {
    return canSendSMS() && !!paziente.numero_contatto;
  };

  const patientsWithPhone = richiami.filter(r => r.numero_contatto);
  const allWithPhoneSelected = patientsWithPhone.length > 0 && patientsWithPhone.every(r => selectedPatients.has(r.DB_CODE));

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2">Caricamento richiami...</p>
      </div>
    );
  }

  return (
    <div>

      {/* Bulk Actions Bar */}
      {/* This section is now handled by RecallsSMSActionsCard */}


      {/* Barra di ricerca e selettore pagina */}
      <CRow className="mb-3 align-items-center">
        <CCol md={6}>
          <CInputGroup>
            <CInputGroupText>
              <CIcon icon={cilSearch} />
            </CInputGroupText>
            <CFormInput
              placeholder="Cerca per nome, città o telefono..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            />
            {searchTerm && (
              <CButton
                color="outline-secondary"
                onClick={() => { setSearchTerm(''); setPage(1); }}
                style={{ borderLeft: 'none' }}
              >
                ✕
              </CButton>
            )}
          </CInputGroup>
        </CCol>
        <CCol md="auto" className="d-flex gap-2 align-items-center">
          <CDropdown>
            <CDropdownToggle color="outline-secondary" size="sm">
              <CIcon icon={cilLocationPin} className="me-1" /> Città
            </CDropdownToggle>
            <CDropdownMenu><CDropdownItem disabled>Tutte le città</CDropdownItem></CDropdownMenu>
          </CDropdown>
          <CDropdown>
            <CDropdownToggle color="outline-secondary" size="sm">
              <CIcon icon={cilFilter} className="me-1" /> Priorità
            </CDropdownToggle>
            <CDropdownMenu><CDropdownItem disabled>Tutte</CDropdownItem></CDropdownMenu>
          </CDropdown>
          <CDropdown>
            <CDropdownToggle color="outline-secondary" size="sm">
              <CIcon icon={cilFilter} className="me-1" /> Stato
            </CDropdownToggle>
            <CDropdownMenu><CDropdownItem disabled>Tutti</CDropdownItem></CDropdownMenu>
          </CDropdown>
          <CButton color="outline-primary" size="sm" disabled>
            <CIcon icon={cilReload} className="me-1" /> Aggiorna
          </CButton>
          <CButton color="outline-primary" size="sm" disabled>
            <CIcon icon={cilCloudDownload} className="me-1" /> Esporta
          </CButton>
        </CCol>
        <CCol className="d-flex justify-content-end align-items-center gap-2">
          <CFormSelect
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ width: 140 }}
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt} per pagina</option>
            ))}
          </CFormSelect>
          <CButton
            color="light"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            &lt;
          </CButton>
          <span className="mx-1">{page} / {totalPages}</span>
          <CButton
            color="light"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            &gt;
          </CButton>
        </CCol>
      </CRow>


      <CTable hover responsive bordered small>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell className="text-center" width={40}>
              <CFormCheck
                checked={allWithPhoneSelected}
                indeterminate={selectedPatients.size > 0 && !allWithPhoneSelected}
                onChange={e => handleSelectAll(e.target.checked)}
                title="Seleziona tutti"
              />
            </CTableHeaderCell>
            <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('nome')}>
              Paziente {sortBy === 'nome' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('citta')}>
              Città {sortBy === 'citta' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center">Contatto</CTableHeaderCell>
            <CTableHeaderCell className="text-center">Ultima Visita</CTableHeaderCell>
            <CTableHeaderCell className="text-center">Giorni</CTableHeaderCell>
            <CTableHeaderCell className="text-center">Tipo Richiamo</CTableHeaderCell>
            <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('priorita')}>
              Priorità {sortBy === 'priorita' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('stato')}>
              Stato {sortBy === 'stato' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center">Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {paginatedRichiami.length === 0 ? (
            <CTableRow>
              <CTableDataCell colSpan={9} className="text-center py-4">
                Nessun richiamo trovato
              </CTableDataCell>
            </CTableRow>
          ) : (
            paginatedRichiami.map((richiamo) => (
              <CTableRow key={richiamo.DB_CODE}>
                {/* Paziente column */}
                <CTableDataCell className="text-center">
                  {richiamo.numero_contatto && (
                    <CFormCheck
                      checked={selectedPatients.has(richiamo.DB_CODE)}
                      onChange={e => {
                        const newSet = new Set(selectedPatients);
                        if (e.target.checked) newSet.add(richiamo.DB_CODE);
                        else newSet.delete(richiamo.DB_CODE);
                        setSelectedPatients(newSet);
                      }}
                    />
                  )}
                </CTableDataCell>
                <CTableDataCell>
                  <div>
                    <strong>{richiamo.nome_completo}</strong>
                    <br />
                    <small className="text-muted">{richiamo.DB_CODE}</small>
                  </div>
                </CTableDataCell>
                <CTableDataCell>{richiamo.citta_clean}</CTableDataCell>
                <CTableDataCell className="text-center">
                  {richiamo.numero_contatto ? (
                    <div>
                      <span className="text-success">{richiamo.numero_contatto}</span>
                      {isSMSEnabled() && (
                        <CBadge color="success" className="ms-2">📱</CBadge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">Nessun contatto</span>
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  {richiamo.ultima_visita ? (
                    new Date(richiamo.ultima_visita).toLocaleDateString('it-IT')
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  {richiamo.giorni_ultima_visita ? (
                    <CBadge color={richiamo.giorni_ultima_visita > 180 ? 'danger' : 'warning'}>
                      {richiamo.giorni_ultima_visita}
                    </CBadge>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  <CBadge color="info">
                    {richiamo.tipo_richiamo_desc}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  <CBadge color={getPriorityColor(richiamo.recall_priority)}>
                    {richiamo.recall_priority}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  <CBadge color={getStatusColor(richiamo.recall_status)}>
                    {richiamo.recall_status}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  <CButtonGroup size="sm">
                    {/* SMS Button */}
                    {canSendSMSToPatient(richiamo) ? (
                      <CButton
                        color="success"
                        onClick={() => handleSendSMS(richiamo)}
                        title="Invia SMS"
                      >
                        📱
                      </CButton>
                    ) : isSMSEnabled() ? (
                      <CButton
                        color="secondary"
                        disabled
                        title="Numero telefono mancante"
                      >
                        📱
                      </CButton>
                    ) : null}
                    {/* Dropdown azioni */}
                    <CDropdown>
                      <CDropdownToggle color="primary" caret>
                        Richiama
                      </CDropdownToggle>
                      <CDropdownMenu>
                        <CDropdownItem onClick={() => handleSendSMS(richiamo)}>
                          📱 Invia SMS
                        </CDropdownItem>
                        <CDropdownItem onClick={() => {
                        }}>
                          📧 Email
                        </CDropdownItem>
                        <CDropdownItem onClick={() => {
                        }}>
                          ✅ Segna contattato
                        </CDropdownItem>
                        {/* Divider */}
                        <CDropdownItem disabled style={{ pointerEvents: 'none', background: 'transparent', border: 'none', height: 1, padding: 0 }}>
                          <hr className='my-1' />
                        </CDropdownItem>
                        <CDropdownItem onClick={() => {
                        }}>
                          👤 Visualizza paziente
                        </CDropdownItem>
                      </CDropdownMenu>
                    </CDropdown>
                  </CButtonGroup>
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
            &lt; Prec
          </CButton>
          <span className="mx-2">Pagina {page} di {totalPages}</span>
          <CButton
            color="light"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Succ &gt;
          </CButton>
        </div>
      </div>

      {/* SMS Preview Modal */}
      <SMSPreviewModal
        visible={smsModalVisible}
        onClose={() => {
          setSmsModalVisible(false);
          setSelectedPatient(null);
        }}
        paziente={selectedPatient}
        onSMSSent={handleSMSSent}
      />

      {/* Toast Notifications */}
      <CToaster placement="top-end">
        {toasts.map((toast) => (
          <CToast key={toast.id} autohide visible color={toast.color}>
            <CToastBody>{toast.message}</CToastBody>
          </CToast>
        ))}
      </CToaster>
    </div>
  );
};

export default RecallsTable;