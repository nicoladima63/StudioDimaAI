import React, { useEffect, useState } from 'react'
import { CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell, CSpinner, CAlert, CButton } from '@coreui/react'
import automationMessagesService, { AutomationMessage } from '../services/automationMessagesService'

const fmtDateTime = (s: string) => new Date(s).toLocaleString('it-IT')

const AutomationMessages: React.FC = () => {
  const [items, setItems] = useState<AutomationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await automationMessagesService.list(1, 100)
      setItems(res.data || [])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])


  function getResultMessage(resultJson?: string | null): string {
    if (!resultJson) return '—';
    try {
      const parsed = JSON.parse(resultJson);
      return parsed?.message ?? '—';
    } catch {
      return resultJson;
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5>Log messaggi inviati per prima visita</h5>
        <CButton color="secondary" size="sm" onClick={load} disabled={loading}>Aggiorna</CButton>
      </div>

      {error && <CAlert color="danger">{error}</CAlert>}

      {loading ? (
        <div className="d-flex justify-content-center py-4"><CSpinner color="primary" /></div>
      ) : items.length === 0 ? (
        <CAlert color="info">Nessun messaggio registrato.</CAlert>
      ) : (
        <CTable striped hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Inviato il</CTableHeaderCell>
              <CTableHeaderCell>Canale</CTableHeaderCell>
              <CTableHeaderCell>Destinatario</CTableHeaderCell>
              <CTableHeaderCell>Messaggio</CTableHeaderCell>
              <CTableHeaderCell>Risultato</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {items.map(it => (
              <CTableRow key={it.id}>
                <CTableDataCell><small>{fmtDateTime(it.created_at)}</small></CTableDataCell>
                <CTableDataCell>{it.channel || 'nd'}</CTableDataCell>
                <CTableDataCell><small className="text-muted">{it.recipient}</small></CTableDataCell>
                <CTableDataCell><small>{it.message_text ? (it.message_text.length > 120 ? it.message_text.slice(0, 120) + '…' : it.message_text) : '—'}</small></CTableDataCell>
                <CTableDataCell><small>{getResultMessage(it.result_json)}</small></CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      )}
    </div>
  )
}

export default AutomationMessages
