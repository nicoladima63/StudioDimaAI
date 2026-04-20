import React, { useEffect, useState } from 'react'
import {
  CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell,
  CButton, CSpinner, CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CPagination, CPaginationItem, CCard, CCardBody, CFormInput, CInputGroup, CInputGroupText, CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilChatBubble, cilSearch, cilTrash } from '@coreui/icons'
import type { Conversazione, Messaggio } from '../types/bot.types'
import botService from '../services/botService'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const ConversazioniTab: React.FC = () => {
  const [conversazioni, setConversazioni] = useState<Conversazione[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedConv, setSelectedConv] = useState<Conversazione | null>(null)
  const [messaggi, setMessaggi] = useState<Messaggio[]>([])
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [searchPhone, setSearchPhone] = useState('')
  const [searchResult, setSearchResult] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const perPage = 20
  const totalPages = Math.ceil(total / perPage)

  const load = async (p = page) => {
    setLoading(true)
    try {
      const res = await botService.apiGetConversazioni(p, perPage)
      if (res.success) {
        setConversazioni(res.data.conversazioni)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(page) }, [page])

  const handleOpenChat = async (conv: Conversazione) => {
    setSelectedConv(conv)
    setLoadingMsg(true)
    setMessaggi([])
    try {
      const res = await botService.apiGetMessaggi(conv.id)
      if (res.success) setMessaggi(res.data.messaggi)
    } finally {
      setLoadingMsg(false)
    }
  }

  const nomePaziente = (c: Conversazione) => c.db_panome || c.wa_nome || c.wa_jid.replace('@s.whatsapp.net', '')

  const handleDelete = async (c: Conversazione) => {
    if (!confirm(`Eliminare la conversazione di ${nomePaziente(c)}? Verranno cancellati tutti i messaggi.`)) return
    try {
      await botService.apiDeleteConversazione(c.id)
    } catch {
      // ignora errori di risposta — il server elimina correttamente anche se la risposta non è standard
    }
    // ricarica sempre per riflettere lo stato reale del DB
    load(page)
  }

  const handleSearchPhone = async () => {
    if (!searchPhone.trim()) return
    setSearching(true)
    setSearchResult(null)
    try {
      const res = await botService.apiSearchPazienteByPhone(searchPhone.trim())
      if (res.success) {
        if (res.data.found && res.data.paziente) {
          const p = res.data.paziente
          setSearchResult(`Trovato: ${p.nome || ''} — tel: ${p.telefono || '-'} — cell: ${p.cellulare || '-'}`.trim())
        } else {
          setSearchResult('Nessun paziente trovato con questo numero')
        }
      }
    } catch {
      setSearchResult('Errore nella ricerca')
    } finally {
      setSearching(false)
    }
  }

  return (
    <>
      <CCard className="mb-3">
        <CCardBody>
          <div className="small text-muted mb-2">Verifica lookup paziente da numero telefono</div>
          <CInputGroup>
            <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
            <CFormInput
              placeholder="Es. 3335467518"
              value={searchPhone}
              onChange={e => { setSearchPhone(e.target.value); setSearchResult(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSearchPhone()}
            />
            <CButton color="primary" onClick={handleSearchPhone} disabled={searching || !searchPhone.trim()}>
              {searching ? <CSpinner size="sm" /> : 'Cerca'}
            </CButton>
          </CInputGroup>
          {searchResult && (
            <CAlert color={searchResult.startsWith('Trovato') ? 'success' : 'warning'} className="mt-2 mb-0 py-2">
              {searchResult}
            </CAlert>
          )}
        </CCardBody>
      </CCard>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted">{total} conversazioni totali</span>
        <CButton color="secondary" size="sm" onClick={() => load(page)} disabled={loading}>
          <CIcon icon={cilReload} className="me-1" />
          Aggiorna
        </CButton>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-4"><CSpinner color="primary" /></div>
      ) : (
        <>
          <CTable striped hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Paziente</CTableHeaderCell>
                <CTableHeaderCell>Iniziata</CTableHeaderCell>
                <CTableHeaderCell>Ultima attività</CTableHeaderCell>
                <CTableHeaderCell>Stato</CTableHeaderCell>
                <CTableHeaderCell style={{ width: '80px' }}></CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {conversazioni.map(c => (
                <CTableRow key={c.id}>
                  <CTableDataCell>
                    <div>{nomePaziente(c)}</div>
                    <small className="text-muted font-monospace">{c.wa_jid.replace('@s.whatsapp.net', '')}</small>
                  </CTableDataCell>
                  <CTableDataCell>{formatDate(c.iniziata_at)}</CTableDataCell>
                  <CTableDataCell>{formatDate(c.ultima_attivita)}</CTableDataCell>
                  <CTableDataCell>
                    {c.escalata_at
                      ? <CBadge color="warning">Escalata</CBadge>
                      : c.aperta
                        ? <CBadge color="success">Aperta</CBadge>
                        : <CBadge color="secondary">Chiusa</CBadge>
                    }
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton color="primary" variant="ghost" size="sm" className="me-1" onClick={() => handleOpenChat(c)}>
                      <CIcon icon={cilChatBubble} />
                    </CButton>
                    <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(c)}>
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>

          {totalPages > 1 && (
            <CPagination className="justify-content-center mt-3">
              <CPaginationItem disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</CPaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <CPaginationItem key={p} active={p === page} onClick={() => setPage(p)}>{p}</CPaginationItem>
              ))}
              <CPaginationItem disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</CPaginationItem>
            </CPagination>
          )}
        </>
      )}

      <CModal visible={!!selectedConv} onClose={() => setSelectedConv(null)} size="lg">
        <CModalHeader>
          <CModalTitle>
            {selectedConv ? nomePaziente(selectedConv) : ''} — chat
          </CModalTitle>
        </CModalHeader>
        <CModalBody style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loadingMsg && <div className="text-center"><CSpinner color="primary" /></div>}
          {!loadingMsg && messaggi.map(m => (
            <div
              key={m.id}
              className={`d-flex mb-3 ${m.ruolo === 'user' ? 'justify-content-start' : 'justify-content-end'}`}
            >
              <div
                style={{
                  maxWidth: '75%',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  backgroundColor: m.ruolo === 'user' ? '#e9ecef' : '#0d6efd',
                  color: m.ruolo === 'user' ? '#212529' : '#fff',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.contenuto}
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '4px', textAlign: 'right' }}>
                  {formatDate(m.created_at)}
                  {m.classificazione && <span className="ms-1">· {m.classificazione}</span>}
                </div>
              </div>
            </div>
          ))}
          {!loadingMsg && messaggi.length === 0 && (
            <p className="text-muted text-center">Nessun messaggio</p>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setSelectedConv(null)}>Chiudi</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default ConversazioniTab
