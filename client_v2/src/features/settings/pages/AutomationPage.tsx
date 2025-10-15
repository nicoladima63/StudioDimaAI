import React, { useEffect, useState, useCallback } from 'react';
import {
  CCard, CCardHeader, CCardBody,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CButton
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilReload } from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import { automationService, type AutomationRule } from '@/features/settings/services/automation.service';

const AutomationPage: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await automationService.getRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Errore caricamento regole');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleDelete = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa regola?')) return;
    try {
      setActionBusyId(id);
      await automationService.deleteRule(id);
      await loadRules();
    } catch (e: any) {
      setError(e?.message || 'Errore eliminazione regola');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <PageLayout>
      <PageLayout.Header
        title="Automazioni"
        headerAction={
          <CButton color='info' size='sm' onClick={loadRules} disabled={loading}>
            <CIcon icon={cilReload} className='me-1' /> Aggiorna
          </CButton>
        }
      />

      <PageLayout.ContentBody>
        <CCard>
          <CCardHeader>
            <h5 className='mb-0'>Regole di Automazione</h5>
          </CCardHeader>
          <CCardBody>
            {error && <div className='text-danger mb-2'>{error}</div>}
            {loading && <div>Caricamento...</div>}
            {!loading && (
              <CTable hover responsive striped small>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>ID</CTableHeaderCell>
                    <CTableHeaderCell>Nome</CTableHeaderCell>
                    <CTableHeaderCell>Trigger</CTableHeaderCell>
                    <CTableHeaderCell>Azione</CTableHeaderCell>
                    <CTableHeaderCell>Stato</CTableHeaderCell>
                    <CTableHeaderCell>Priorità</CTableHeaderCell>
                    <CTableHeaderCell>Monitor</CTableHeaderCell>
                    <CTableHeaderCell>Ultimo Agg.</CTableHeaderCell>
                    <CTableHeaderCell>Azioni</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rules.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={9} className='text-center text-muted'>Nessuna regola trovata</CTableDataCell>
                    </CTableRow>
                  ) : (
                    rules.map((r) => (
                      <CTableRow key={r.id}>
                        <CTableDataCell>{r.id}</CTableDataCell>
                        <CTableDataCell>{r.name}</CTableDataCell>
                        <CTableDataCell>{r.trigger_type}:{r.trigger_id}</CTableDataCell>
                        <CTableDataCell>{r.action_name || r.action_id}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={r.attiva ? 'success' : 'secondary'}>
                            {r.attiva ? 'Attiva' : 'Spenta'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{r.priorita}</CTableDataCell>
                        <CTableDataCell>{(r as any).monitor_id || '-'}</CTableDataCell>
                        <CTableDataCell>{r.updated_at || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CButton
                            color='danger'
                            size='sm'
                            variant='outline'
                            disabled={actionBusyId === r.id || loading}
                            onClick={() => handleDelete(r.id)}
                          >
                            Elimina
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))
                  )}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default AutomationPage;


