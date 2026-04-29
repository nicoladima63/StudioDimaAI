import React, { useEffect, useState } from 'react'
import {
  CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell,
  CButton, CSpinner, CBadge, CAlert, CFormSelect, CFormInput, CInputGroup,
  CInputGroupText, CPagination, CPaginationItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilChatBubble, cilPhone } from '@coreui/icons'
import { remindersService } from '@/features/scheduler/services/remindersService'
import type { CommunicationItem } from '@/features/scheduler/services/remindersService'

const fmtDateTime = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const StatoBadge: React.FC<{ item: CommunicationItem }> = ({ item }) => {
  if (item.response === 'confirmed') return <CBadge color="success">Confermato</CBadge>
  if (item.response === 'cancelled') return <CBadge color="danger">Cancellato</CBadge>
  if (item.stato === 'sent')         return <CBadge color="primary">Inviato</CBadge>
  if (item.stato === 'failed')       return <CBadge color="secondary">Fallito</CBadge>
  return <CBadge color="warning">{item.stato}</CBadge>
}

const TipoBadge: React.FC<{ tipo: string }> = ({ tipo }) => {
  if (tipo === '24h')      return <CBadge color="info">24h</CBadge>
  if (tipo === '2h')       return <CBadge color="primary">2h</CBadge>
  if (tipo === 'followup') return <CBadge color="warning">Follow-up</CBadge>
  return <CBadge color="secondary">{tipo}</CBadge>
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

const StoricoComunicazioniTab: React.FC = () => {
  const [items, setItems]       = useState<CommunicationItem[]>([])
  const [total, setTotal]       = useState(0)
  const [pages, setPages]       = useState(1)
  const [page, setPage]         = useState(1)
  const [perPage, setPerPage]   = useState(20)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = async (p = page, pp = perPage) => {
    setLoading(true)
    setError(null)
    try {
      const res = await remindersService.apiGetCommunications(p, pp)
      setItems(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(page, perPage) }, [page, perPage])

  const filtered = search.trim()
    ? items.filter(i =>
        (i.patient_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.phone || '').includes(search)
      )
    : items

  const handlePerPage = (val: number) => {
    setPerPage(val)
    setPage(1)
  }

  const Paginazione = () => (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <small className="text-muted">
        {total} comunicazioni totali
      </small>
      <div className="d-flex align-items-center gap-2">
        <CInputGroup style={{ width: 'auto' }}>
          <CInputGroupText>Righe</CInputGroupText>
          <CFormSelect
            value={perPage}
            onChange={e => handlePerPage(Number(e.target.value))}
            style={{ width: '80px' }}
          >
            {PER_PAGE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </CFormSelect>
        </CInputGroup>
        <CPagination>
          <CPaginationItem disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</CPaginationItem>
          <CPaginationItem active>{page} / {pages}</CPaginationItem>
          <CPaginationItem disabled={page === pages} onClick={() => setPage(p => p + 1)}>›</CPaginationItem>
        </CPagination>
      </div>
    </div>
  )

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <CInputGroup style={{ width: '260px' }}>
          <CInputGroupText>Cerca</CInputGroupText>
          <CFormInput
            placeholder="Nome o telefono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </CInputGroup>
        <CButton color="secondary" size="sm" onClick={() => load(page, perPage)} disabled={loading}>
          <CIcon icon={cilReload} className="me-1" />
          Aggiorna
        </CButton>
        <CBadge color="secondary" className="px-3 py-2">{total} totali</CBadge>
      </div>

      <Paginazione />

      {error && <CAlert color="danger" className="mt-2">{error}</CAlert>}

      {loading ? (
        <div className="d-flex justify-content-center py-4"><CSpinner color="primary" /></div>
      ) : filtered.length === 0 ? (
        <CAlert color="info" className="mt-2">Nessuna comunicazione trovata.</CAlert>
      ) : (
        <CTable striped hover responsive className="mt-2">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Paziente</CTableHeaderCell>
              <CTableHeaderCell>Tipo</CTableHeaderCell>
              <CTableHeaderCell>Canale</CTableHeaderCell>
              <CTableHeaderCell>Inviato</CTableHeaderCell>
              <CTableHeaderCell>Stato</CTableHeaderCell>
              <CTableHeaderCell>Risposta</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {filtered.map(item => (
              <CTableRow key={item.id}>
                <CTableDataCell>
                  <div>{item.patient_name || '—'}</div>
                  <small className="text-muted">{item.phone}</small>
                </CTableDataCell>
                <CTableDataCell><TipoBadge tipo={item.tipo} /></CTableDataCell>
                <CTableDataCell>
                  <CIcon icon={item.channel === 'whatsapp' ? cilChatBubble : cilPhone} className="me-1" />
                  {item.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </CTableDataCell>
                <CTableDataCell>
                  <small>{fmtDateTime(item.sent_at || item.created_at)}</small>
                </CTableDataCell>
                <CTableDataCell><StatoBadge item={item} /></CTableDataCell>
                <CTableDataCell>
                  {item.response
                    ? <small className="text-muted">{fmtDateTime(item.sent_at)}</small>
                    : <span className="text-muted">—</span>
                  }
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      )}

      <div className="mt-2"><Paginazione /></div>
    </>
  )
}

export default StoricoComunicazioniTab
