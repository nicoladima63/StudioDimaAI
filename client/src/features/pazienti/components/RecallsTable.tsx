// src/features/pazienti/components/RecallsTable.tsx

import React, { useState } from 'react';
import { 
  CSpinner, 
  CBadge, 
  CButton, 
  CToast, 
  CToastBody, 
  CToaster,
  CButtonGroup,
  CFormCheck,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem
} from '@coreui/react';
import { useSMSStore } from '@/store/smsStore';
import SMSPreviewModal from '@/components/ui/SMSPreviewModal';
import type { PazienteCompleto } from '@/lib/types';
import type { SMSResponse } from '@/api/services/sms.service';

interface RecallsTableProps {
  richiami: PazienteCompleto[];
  loading: boolean;
}

const RecallsTable: React.FC<RecallsTableProps> = ({ richiami, loading }) => {
  // SMS Store
  const { mode: smsMode, isEnabled: isSMSEnabled, canSendSMS } = useSMSStore();

  // Modal state
  const [smsModalVisible, setSmsModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PazienteCompleto | null>(null);

  // Bulk selection state
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
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
  const allWithPhoneSelected = patientsWithPhone.length > 0 && 
    patientsWithPhone.every(r => selectedPatients.has(r.DB_CODE));

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2">Caricamento richiami...</p>
      </div>
    );
  }

  if (richiami.length === 0) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Nessun richiamo trovato</p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      {isSMSEnabled() && patientsWithPhone.length > 0 && (
        <div className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded">
          <div className="d-flex align-items-center gap-3">
            <CFormCheck
              id="select-all"
              checked={allWithPhoneSelected}
              indeterminate={selectedPatients.size > 0 && !allWithPhoneSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              label={`Seleziona tutti (${patientsWithPhone.length} con telefono)`}
            />
            
            {selectedPatients.size > 0 && (
              <CBadge color="info">
                {selectedPatients.size} selezionati
              </CBadge>
            )}
          </div>

          <div className="d-flex gap-2 align-items-center">
            <CBadge color={smsMode === 'prod' ? 'success' : 'warning'}>
              SMS: {smsMode === 'prod' ? 'Produzione' : 'Test'}
            </CBadge>
            
            <CButton
              color="primary"
              size="sm"
              disabled={selectedPatients.size === 0 || bulkLoading}
              onClick={handleBulkSMS}
            >
              {bulkLoading ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Invio...
                </>
              ) : (
                `📤 Invia SMS (${selectedPatients.size})`
              )}
            </CButton>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              {isSMSEnabled() && <th width="40">✓</th>}
              <th>Paziente</th>
              <th>Città</th>
              <th>Contatto</th>
              <th>Ultima Visita</th>
              <th>Giorni</th>
              <th>Tipo Richiamo</th>
              <th>Priorità</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {richiami.map((richiamo) => (
              <tr key={richiamo.DB_CODE}>
                {/* Selection Checkbox */}
                {isSMSEnabled() && (
                  <td>
                    {richiamo.numero_contatto && (
                      <CFormCheck
                        checked={selectedPatients.has(richiamo.DB_CODE)}
                        onChange={(e) => handleSelectPatient(richiamo.DB_CODE, e.target.checked)}
                      />
                    )}
                  </td>
                )}

                {/* Patient Info */}
                <td>
                  <strong>{richiamo.nome_completo}</strong>
                  <br />
                  <small className="text-muted">{richiamo.DB_CODE}</small>
                </td>

                {/* City */}
                <td>{richiamo.citta_clean}</td>

                {/* Contact */}
                <td>
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
                </td>

                {/* Last Visit */}
                <td>
                  {richiamo.ultima_visita ? (
                    new Date(richiamo.ultima_visita).toLocaleDateString('it-IT')
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>

                {/* Days */}
                <td>
                  {richiamo.giorni_ultima_visita ? (
                    <CBadge color={richiamo.giorni_ultima_visita > 180 ? 'danger' : 'warning'}>
                      {richiamo.giorni_ultima_visita}
                    </CBadge>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>

                {/* Recall Type */}
                <td>
                  <CBadge color="info">
                    {richiamo.tipo_richiamo_desc}
                  </CBadge>
                </td>

                {/* Priority */}
                <td>
                  <CBadge color={getPriorityColor(richiamo.recall_priority)}>
                    {richiamo.recall_priority}
                  </CBadge>
                </td>

                {/* Status */}
                <td>
                  <CBadge color={getStatusColor(richiamo.recall_status)}>
                    {richiamo.recall_status}
                  </CBadge>
                </td>

                {/* Actions */}
                <td>
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

                    {/* Other Actions Dropdown */}
                    <CDropdown>
                      <CDropdownToggle color="primary" caret>
                        Richiama
                      </CDropdownToggle>
                      <CDropdownMenu>
                        <CDropdownItem onClick={() => handleSendSMS(richiamo)}>
                          📱 Invia SMS
                        </CDropdownItem>
                        <CDropdownItem onClick={() => {
                          console.log('Email paziente:', richiamo.DB_CODE);
                        }}>
                          📧 Email
                        </CDropdownItem>
                        <CDropdownItem onClick={() => {
                          console.log('Segna come contattato:', richiamo.DB_CODE);
                        }}>
                          ✅ Segna contattato
                        </CDropdownItem>
                        <CDropdownItem divider />
                        <CDropdownItem onClick={() => {
                          console.log('Visualizza paziente:', richiamo.DB_CODE);
                        }}>
                          👤 Visualizza paziente
                        </CDropdownItem>
                      </CDropdownMenu>
                    </CDropdown>
                  </CButtonGroup>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </>
  );
};

export default RecallsTable;