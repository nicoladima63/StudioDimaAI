import React, { useState, useEffect, useMemo } from 'react'
import {
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CSpinner, CAlert, CButton, CBadge, CFormInput, CFormSelect, CRow, CCol,
  CCollapse,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSettings, cilChevronBottom, cilChevronRight, cilFilterX } from '@coreui/icons'

import PageLayout from '@/components/layout/PageLayout'
import ClassificazioneCompleta from '@/features/fornitori/components/ClassificazioneCompleta'
import { useFornitori, useFornitoriStore, type Fornitore } from '@/store/fornitori.store'
import classificazioniService from '@/features/fornitori/services/classificazioni.service'
import type { ClassificazioneCosto } from '@/features/fornitori/types'
import { TipoDiCostoLabels } from '@/features/fornitori/types'

type FiltroStato = 'tutti' | 'classificati' | 'non_classificati' | 'diretti' | 'indiretti' | 'non_deducibili'

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

const FornitoriClassificazione: React.FC = () => {
  const { fornitori, isLoading, error, loadAll } = useFornitori()
  const { invalidateCache } = useFornitoriStore()

  const [classificazioni, setClassificazioni] = useState<ClassificazioneCosto[]>([])
  const [classificazioniLoading, setClassificazioniLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('tutti')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  // Mappa classificazioni per codice
  const classificazioniMap = useMemo(() => {
    const map: Record<string, ClassificazioneCosto> = {}
    classificazioni.forEach(c => {
      if (c.codice_riferimento) map[c.codice_riferimento] = c
    })
    return map
  }, [classificazioni])

  // Carica dati
  useEffect(() => {
    loadAll()
    loadClassificazioni()
  }, [])

  const loadClassificazioni = async () => {
    setClassificazioniLoading(true)
    try {
      const res = await classificazioniService.getFornitoriClassificati()
      if (res.success) {
        setClassificazioni(res.data)
      }
    } catch {
      // silenzioso
    } finally {
      setClassificazioniLoading(false)
    }
  }

  // Filtra e ricerca
  const filteredFornitori = useMemo(() => {
    let result = fornitori

    // Ricerca testo
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(f =>
        f.nome.toLowerCase().includes(term) ||
        f.codice?.toLowerCase().includes(term) ||
        f.id.toLowerCase().includes(term)
      )
    }

    // Filtro stato classificazione
    if (filtroStato !== 'tutti') {
      result = result.filter(f => {
        const cl = classificazioniMap[f.id]
        switch (filtroStato) {
          case 'classificati': return cl && cl.tipo_di_costo
          case 'non_classificati': return !cl || !cl.tipo_di_costo
          case 'diretti': return cl?.tipo_di_costo === 1
          case 'indiretti': return cl?.tipo_di_costo === 2
          case 'non_deducibili': return cl?.tipo_di_costo === 3
          default: return true
        }
      })
    }

    return result
  }, [fornitori, searchTerm, filtroStato, classificazioniMap])

  // Paginazione
  const totalPages = Math.ceil(filteredFornitori.length / perPage)
  const paginatedFornitori = useMemo(() => {
    const start = (page - 1) * perPage
    return filteredFornitori.slice(start, start + perPage)
  }, [filteredFornitori, page, perPage])

  // Reset pagina quando cambiano i filtri
  useEffect(() => { setPage(1) }, [searchTerm, filtroStato, perPage])

  // Statistiche
  const stats = useMemo(() => {
    const total = fornitori.length
    let classificati = 0, diretti = 0, indiretti = 0, nonDeducibili = 0, senzaTipo = 0
    fornitori.forEach(f => {
      const cl = classificazioniMap[f.id]
      if (cl) {
        if (cl.tipo_di_costo === 1) { diretti++; classificati++ }
        else if (cl.tipo_di_costo === 2) { indiretti++; classificati++ }
        else if (cl.tipo_di_costo === 3) { nonDeducibili++; classificati++ }
        else { senzaTipo++ }
      }
    })
    return { total, classificati, diretti, indiretti, nonDeducibili, senzaTipo, nonClassificati: total - classificati - senzaTipo }
  }, [fornitori, classificazioniMap])

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleClassificazioneChange = () => {
    loadClassificazioni()
  }

  const handleRefresh = () => {
    invalidateCache()
    loadAll()
    loadClassificazioni()
    setExpandedRows(new Set())
  }

  const getBadge = (fornitore: Fornitore) => {
    const cl = classificazioniMap[fornitore.id]
    if (!cl || !cl.tipo_di_costo) {
      return <CBadge color="danger" shape="rounded-pill">Non classificato</CBadge>
    }
    const colors: Record<number, string> = { 1: 'success', 2: 'info', 3: 'warning' }
    const label = TipoDiCostoLabels[cl.tipo_di_costo as 1 | 2 | 3] || '?'
    return <CBadge color={colors[cl.tipo_di_costo] || 'secondary'} shape="rounded-pill">{label}</CBadge>
  }

  const getGerarchia = (fornitore: Fornitore) => {
    const cl = classificazioniMap[fornitore.id]
    if (!cl || !cl.contoid) return '-'
    const parts = [cl.contoid]
    if (cl.brancaid) parts.push(cl.brancaid)
    if (cl.sottocontoid) parts.push(cl.sottocontoid)
    return parts.join(' / ')
  }

  // Componente paginazione
  const Pagination = () => {
    if (totalPages <= 1) return null
    const maxButtons = 5
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2))
    const endPage = Math.min(totalPages, startPage + maxButtons - 1)
    if (endPage - startPage + 1 < maxButtons) startPage = Math.max(1, endPage - maxButtons + 1)

    return (
      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <span className="small text-muted">
            {((page - 1) * perPage) + 1}-{Math.min(page * perPage, filteredFornitori.length)} di {filteredFornitori.length}
          </span>
          <CFormSelect
            size="sm"
            style={{ width: '80px' }}
            value={perPage}
            onChange={e => setPerPage(Number(e.target.value))}
          >
            {ITEMS_PER_PAGE_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </CFormSelect>
        </div>
        <div className="d-flex gap-1">
          <CButton size="sm" color="secondary" variant="outline" disabled={page <= 1} onClick={() => setPage(1)}>
            &laquo;
          </CButton>
          <CButton size="sm" color="secondary" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            &lsaquo;
          </CButton>
          {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => (
            <CButton
              key={p}
              size="sm"
              color={p === page ? 'primary' : 'secondary'}
              variant={p === page ? undefined : 'outline'}
              onClick={() => setPage(p)}
            >
              {p}
            </CButton>
          ))}
          <CButton size="sm" color="secondary" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            &rsaquo;
          </CButton>
          <CButton size="sm" color="secondary" variant="outline" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
            &raquo;
          </CButton>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <PageLayout>
        <PageLayout.Header title="Classificazione Fornitori" />
        <PageLayout.ContentBody>
          <CAlert color="danger">Errore: {error}</CAlert>
        </PageLayout.ContentBody>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageLayout.Header
        title="Classificazione Fornitori"
        headerAction={
          <CButton color="primary" onClick={handleRefresh} disabled={isLoading || classificazioniLoading}>
            {(isLoading || classificazioniLoading) ? (
              <><CSpinner size="sm" className="me-2" />Caricamento...</>
            ) : (
              <><CIcon icon={cilSettings} className="me-2" />Aggiorna</>
            )}
          </CButton>
        }
      />

      <PageLayout.ContentHeader>
        {/* Statistiche */}
        <CRow className="g-3 mb-3">
          <CCol xs={6} md={2}>
            <div className="text-center">
              <div className="fs-4 fw-bold">{stats.total}</div>
              <small className="text-muted">Totale</small>
            </div>
          </CCol>
          <CCol xs={6} md={2}>
            <div className="text-center">
              <div className="fs-4 fw-bold text-success">{stats.classificati}</div>
              <small className="text-muted">Classificati</small>
            </div>
          </CCol>
          <CCol xs={6} md={2}>
            <div className="text-center">
              <div className="fs-4 fw-bold text-danger">{stats.nonClassificati}</div>
              <small className="text-muted">Non classificati</small>
            </div>
          </CCol>
          <CCol xs={6} md={2}>
            <div className="text-center">
              <div className="fs-4 fw-bold" style={{ color: '#2eb85c' }}>{stats.diretti}</div>
              <small className="text-muted">Diretti</small>
            </div>
          </CCol>
          <CCol xs={6} md={2}>
            <div className="text-center">
              <div className="fs-4 fw-bold" style={{ color: '#3399ff' }}>{stats.indiretti}</div>
              <small className="text-muted">Indiretti</small>
            </div>
          </CCol>
          <CCol xs={6} md={2}>
            <div className="text-center">
              <div className="fs-4 fw-bold" style={{ color: '#f9b115' }}>{stats.nonDeducibili}</div>
              <small className="text-muted">Non Deducibili</small>
            </div>
          </CCol>
        </CRow>

        {/* Filtri */}
        <CRow className="g-2 align-items-end">
          <CCol xs={12} md={5}>
            <label className="form-label fw-bold small mb-1">Ricerca</label>
            <CFormInput
              size="sm"
              placeholder="Cerca per nome, codice..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </CCol>
          <CCol xs={10} md={4}>
            <label className="form-label fw-bold small mb-1">Filtro stato</label>
            <CFormSelect
              size="sm"
              value={filtroStato}
              onChange={e => setFiltroStato(e.target.value as FiltroStato)}
            >
              <option value="tutti">Tutti ({stats.total})</option>
              <option value="classificati">Classificati ({stats.classificati})</option>
              <option value="non_classificati">Non classificati ({stats.nonClassificati})</option>
              <option value="diretti">Diretti ({stats.diretti})</option>
              <option value="indiretti">Indiretti ({stats.indiretti})</option>
              <option value="non_deducibili">Non Deducibili ({stats.nonDeducibili})</option>
            </CFormSelect>
          </CCol>
          <CCol xs={2} md={3}>
            {(searchTerm || filtroStato !== 'tutti') && (
              <CButton
                size="sm"
                color="secondary"
                variant="outline"
                onClick={() => { setSearchTerm(''); setFiltroStato('tutti') }}
              >
                <CIcon icon={cilFilterX} size="sm" className="me-1" />
                Reset
              </CButton>
            )}
          </CCol>
        </CRow>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <CCol md={6}>
          {/* Paginazione sopra */}
          <div className="mb-2">
            <Pagination />
          </div>

          {isLoading ? (
            <div className="text-center py-4">
              <CSpinner />
              <p className="mt-2">Caricamento fornitori...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <CTable striped hover small>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell style={{ width: '40px' }}></CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '80px' }}>Codice</CTableHeaderCell>
                    <CTableHeaderCell>Nome</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '140px' }}>Tipo Costo</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '120px' }}>Gerarchia</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {paginatedFornitori.map(fornitore => {
                    const isExpanded = expandedRows.has(fornitore.id)
                    return (
                      <React.Fragment key={fornitore.id}>
                        <CTableRow
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleRow(fornitore.id)}
                          className={isExpanded ? 'table-active' : ''}
                        >
                          <CTableDataCell className="text-center">
                            <CIcon
                              icon={isExpanded ? cilChevronBottom : cilChevronRight}
                              size="sm"
                            />
                          </CTableDataCell>
                          <CTableDataCell>
                            <code className="small">{fornitore.codice || fornitore.id}</code>
                          </CTableDataCell>
                          <CTableDataCell>
                            <strong>{fornitore.nome}</strong>
                          </CTableDataCell>
                          <CTableDataCell>
                            {getBadge(fornitore)}
                          </CTableDataCell>
                          <CTableDataCell>
                            <span className="small text-muted">{getGerarchia(fornitore)}</span>
                          </CTableDataCell>
                        </CTableRow>
                        <CTableRow>
                          <CTableDataCell colSpan={5} className="p-0 border-0">
                            <CCollapse visible={isExpanded}>
                              <div className="p-3 bg-light border-bottom">
                                <ClassificazioneCompleta
                                  codiceFornitore={fornitore.id}
                                  fornitoreNome={fornitore.nome}
                                  classificazione={classificazioniMap[fornitore.id] || null}
                                  onClassificazioneChange={handleClassificazioneChange}
                                />
                              </div>
                            </CCollapse>
                          </CTableDataCell>
                        </CTableRow>
                      </React.Fragment>
                    )
                  })}
                  {paginatedFornitori.length === 0 && (
                    <CTableRow>
                      <CTableDataCell colSpan={5} className="text-center text-muted py-4">
                        Nessun fornitore trovato con i filtri selezionati
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </div>
          )}

          {/* Paginazione sotto */}
          <div className="mt-2">
            <Pagination />
          </div>
        </CCol>
      </PageLayout.ContentBody>
    </PageLayout>
  )
}

export default FornitoriClassificazione
