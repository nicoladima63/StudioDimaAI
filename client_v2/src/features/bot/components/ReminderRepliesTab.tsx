import React, { useEffect, useState } from 'react'
import {
  CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell,
  CButton, CSpinner, CBadge, CAlert, CFormSelect, CInputGroup, CInputGroupText,
  CFormInput,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilPhone, cilChatBubble } from '@coreui/icons'
import { remindersService } from '@/features/scheduler/services/remindersService'
import type { ReminderReply } from '@/features/scheduler/services/remindersService'

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const RispostaBadge: React.FC<{ reply: ReminderReply }> = ({ reply }) => {
  const r = reply.response || reply.stato
  if (r === 'confirmed') return <CBadge color="success">Confermato</CBadge>
  if (r === 'cancelled') return <CBadge color="danger">Cancellato</CBadge>
  if (reply.stato === 'failed') return <CBadge color="secondary">Fallito</CBadge>
  return <CBadge color="warning">In attesa</CBadge>
}

const ReminderRepliesTab: React.FC = () => {
  const [items, setItems] = useState<ReminderReply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [dateFilter, setDateFilter] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await remindersService.apiGetReplies(days, dateFilter || undefined)
      setItems(res.items)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days, dateFilter])

  const confirmed = items.filter(i => i.response === 'confirmed' || i.stato === 'confirmed').length
  const cancelled = items.filter(i => i.response === 'cancelled' || i.stato === 'cancelled').length
  const pending = items.filter(i => !i.response && i.stato === 'sent').length

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <CInputGroup style={{ width: 'auto' }}>
          <CInputGroupText>Data</CInputGroupText>
          <CFormInput
            type="date"
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setDays(7) }}
            style={{ width: '150px' }}
          />
        </CInputGroup>
        {!dateFilter && (
          <CInputGroup style={{ width: 'auto' }}>
            <CInputGroupText>Ultimi</CInputGroupText>
            <CFormSelect
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              style={{ width: '120px' }}
            >
              <option value={1}>1 giorno</option>
              <option value={3}>3 giorni</option>
              <option value={7}>7 giorni</option>
              <option value={30}>30 giorni</option>
            </CFormSelect>
          </CInputGroup>
        )}
        {dateFilter && (
          <CButton color="secondary" variant="outline" size="sm" onClick={() => setDateFilter('')}>
            Rimuovi filtro data
          </CButton>
        )}
        <CButton color="secondary" size="sm" onClick={load} disabled={loading}>
          <CIcon icon={cilReload} className="me-1" />
          Aggiorna
        </CButton>
      </div>

      <div className="d-flex gap-3 mb-3">
        <CBadge color="success" className="px-3 py-2">{confirmed} confermati</CBadge>
        <CBadge color="danger" className="px-3 py-2">{cancelled} cancellati</CBadge>
        <CBadge color="warning" className="px-3 py-2">{pending} in attesa</CBadge>
        <CBadge color="secondary" className="px-3 py-2">{items.length} totali</CBadge>
      </div>

      {error && <CAlert color="danger">{error}</CAlert>}

      {loading ? (
        <div className="d-flex justify-content-center py-4"><CSpinner color="primary" /></div>
      ) : items.length === 0 ? (
        <CAlert color="info">Nessun reminder nel periodo selezionato.</CAlert>
      ) : (
        <CTable striped hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Paziente</CTableHeaderCell>
              <CTableHeaderCell>App.</CTableHeaderCell>
              <CTableHeaderCell>Ora</CTableHeaderCell>
              <CTableHeaderCell>Tipo</CTableHeaderCell>
              <CTableHeaderCell>Canale</CTableHeaderCell>
              <CTableHeaderCell>Inviato</CTableHeaderCell>
              <CTableHeaderCell>Risposta</CTableHeaderCell>
              <CTableHeaderCell>Quando</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {items.map(item => (
              <CTableRow key={item.id}>
                <CTableDataCell>
                  <div>{item.patient_name || '—'}</div>
                  <small className="text-muted">{item.phone}</small>
                </CTableDataCell>
                <CTableDataCell>{item.appointment_date ? fmtDate(item.appointment_date + 'T00:00:00') : '—'}</CTableDataCell>
                <CTableDataCell>{item.appointment_time || '—'}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={item.reminder_type === '24h' ? 'info' : item.reminder_type === '2h' ? 'primary' : 'secondary'}>
                    {item.reminder_type}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CIcon icon={item.channel === 'whatsapp' ? cilChatBubble : cilPhone} className="me-1" />
                  {item.channel}
                </CTableDataCell>
                <CTableDataCell>
                  <small>{fmtDateTime(item.created_at)}</small>
                </CTableDataCell>
                <CTableDataCell><RispostaBadge reply={item} /></CTableDataCell>
                <CTableDataCell>
                  {item.response_at ? <small>{fmtDateTime(item.response_at)}</small> : <span className="text-muted">—</span>}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      )}
    </>
  )
}

export default ReminderRepliesTab
