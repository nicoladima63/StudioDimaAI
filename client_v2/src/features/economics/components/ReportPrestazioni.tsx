import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard, CCardBody, CCardHeader, CRow, CCol,
  CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell,
  CFormSelect, CSpinner, CAlert, CBadge, CNav, CNavItem, CNavLink, CTabContent, CTabPane,
} from '@coreui/react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { economicsService } from '../services/economics.service'
import type { ReportPrestazioniData, ReportPrestazioniAnno, PrestazioneDistribuzione } from '../types'

const COLORI = ['#321fdb', '#2eb85c', '#f9b115', '#e55353', '#3399ff', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#e74c3c', '#2ecc71', '#95a5a6']

const currentYear = new Date().getFullYear()
const ANNI_DISPONIBILI = Array.from({ length: 5 }, (_, i) => currentYear - i)

const fmtEur = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const ReportPrestazioni: React.FC = () => {
  const [data, setData] = useState<ReportPrestazioniData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [annoSelezionato, setAnnoSelezionato] = useState<number>(currentYear)
  const [annoConfronto, setAnnoConfronto] = useState<number | null>(null)
  const [subTab, setSubTab] = useState<string>('categorie')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const anni = annoConfronto ? [annoConfronto, annoSelezionato] : undefined
      const anno = annoConfronto ? undefined : annoSelezionato
      const res = await economicsService.apiGetReportPrestazioni(anno, anni)
      if (res.state === 'success') {
        setData(res.data)
      } else {
        setError(res.error || 'Errore nel caricamento')
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }, [annoSelezionato, annoConfronto])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className="text-center p-4"><CSpinner /></div>
  if (error) return <CAlert color="danger">{error}</CAlert>
  if (!data || data.anni.length === 0) return <CAlert color="warning">Nessun dato disponibile</CAlert>

  const annoData = data.anni[data.anni.length - 1]
  const confronto = data.confronto

  return (
    <>
      {/* Selettore anni */}
      <CRow className="mb-3">
        <CCol sm={3}>
          <label className="form-label fw-bold">Anno</label>
          <CFormSelect value={annoSelezionato} onChange={(e) => setAnnoSelezionato(Number(e.target.value))}>
            {ANNI_DISPONIBILI.map((a) => <option key={a} value={a}>{a}</option>)}
          </CFormSelect>
        </CCol>
        <CCol sm={3}>
          <label className="form-label fw-bold">Confronta con</label>
          <CFormSelect value={annoConfronto ?? ''} onChange={(e) => setAnnoConfronto(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Nessun confronto</option>
            {ANNI_DISPONIBILI.filter((a) => a !== annoSelezionato).map((a) => <option key={a} value={a}>{a}</option>)}
          </CFormSelect>
        </CCol>
        <CCol sm={6} className="d-flex align-items-end">
          <div>
            <CBadge color="primary" className="me-2 fs-6">{annoData.totale_prestazioni} prestazioni</CBadge>
            <CBadge color="success" className="fs-6">{fmtEur(annoData.totale_fatturato)}</CBadge>
          </div>
        </CCol>
      </CRow>

      {/* Sub-tabs */}
      <CNav variant="pills" className="mb-3">
        {[
          { key: 'categorie', label: 'Per Categoria' },
          { key: 'top', label: 'Top Prestazioni' },
          { key: 'tutte', label: 'Tutte le Prestazioni' },
        ].map((t) => (
          <CNavItem key={t.key}>
            <CNavLink active={subTab === t.key} onClick={() => setSubTab(t.key)} style={{ cursor: 'pointer' }}>
              {t.label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>

      <CTabContent>
        {/* Per Categoria */}
        <CTabPane visible={subTab === 'categorie'}>
          <CRow>
            <CCol lg={7}>
              <CCard className="mb-4">
                <CCardHeader><strong>Distribuzione per Categoria</strong></CCardHeader>
                <CCardBody>
                  <CTable striped hover responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Categoria</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">N.</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">%</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Fatturato</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">% Fatt.</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Media</CTableHeaderCell>
                        {confronto && <CTableHeaderCell className="text-end">Delta</CTableHeaderCell>}
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {annoData.per_categoria.map((c) => {
                        const delta = confronto?.delta_per_categoria.find((d) => d.categoria_nome === c.categoria_nome)
                        return (
                          <CTableRow key={c.categoria_nome}>
                            <CTableDataCell><strong>{c.categoria_nome}</strong></CTableDataCell>
                            <CTableDataCell className="text-end">{c.count}</CTableDataCell>
                            <CTableDataCell className="text-end">{c.percentuale_count}%</CTableDataCell>
                            <CTableDataCell className="text-end">{fmtEur(c.fatturato)}</CTableDataCell>
                            <CTableDataCell className="text-end">{c.percentuale_fatturato}%</CTableDataCell>
                            <CTableDataCell className="text-end">{fmtEur(c.ricavo_medio)}</CTableDataCell>
                            {confronto && (
                              <CTableDataCell className="text-end">
                                {delta && (
                                  <CBadge color={delta.delta_fatturato > 0 ? 'success' : delta.delta_fatturato < 0 ? 'danger' : 'secondary'}>
                                    {delta.variazione_pct !== null ? `${delta.variazione_pct > 0 ? '+' : ''}${delta.variazione_pct}%` : 'N/A'}
                                  </CBadge>
                                )}
                              </CTableDataCell>
                            )}
                          </CTableRow>
                        )
                      })}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol lg={5}>
              <CCard className="mb-4">
                <CCardHeader><strong>Fatturato per Categoria</strong></CCardHeader>
                <CCardBody>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={annoData.per_categoria.map((c) => ({ name: c.categoria_nome, value: c.fatturato }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {annoData.per_categoria.map((_, i) => <Cell key={i} fill={COLORI[i % COLORI.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtEur(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        {/* Top Prestazioni */}
        <CTabPane visible={subTab === 'top'}>
          <CRow>
            <CCol lg={6}>
              <RankingCard title="Top 10 per Frequenza" items={annoData.top_frequenza} sortBy="count" />
            </CCol>
            <CCol lg={6}>
              <RankingCard title="Top 10 per Fatturato" items={annoData.top_fatturato} sortBy="fatturato" />
            </CCol>
          </CRow>
          <CRow>
            <CCol lg={6}>
              <RankingCard title="Meno Eseguite" items={annoData.bottom_frequenza} sortBy="count" />
            </CCol>
            <CCol lg={6}>
              <RankingCard title="Meno Redditizie" items={annoData.bottom_fatturato} sortBy="fatturato" />
            </CCol>
          </CRow>
          <CCard className="mb-4">
            <CCardHeader><strong>Top 10 Prestazioni per Fatturato</strong></CCardHeader>
            <CCardBody>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={annoData.top_fatturato.map((p) => ({
                    nome: p.descrizione.length > 25 ? p.descrizione.substring(0, 25) + '...' : p.descrizione,
                    fatturato: p.fatturato,
                    count: p.count,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => fmtEur(v)} />
                  <Bar dataKey="fatturato" name="Fatturato" fill="#321fdb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CCardBody>
          </CCard>
        </CTabPane>

        {/* Tutte le Prestazioni */}
        <CTabPane visible={subTab === 'tutte'}>
          <TuttePrestazioniView data={annoData} />
        </CTabPane>
      </CTabContent>
    </>
  )
}

const RankingCard: React.FC<{ title: string; items: PrestazioneDistribuzione[]; sortBy: 'count' | 'fatturato' }> = ({ title, items, sortBy }) => (
  <CCard className="mb-4">
    <CCardHeader><strong>{title}</strong></CCardHeader>
    <CCardBody>
      <CTable small striped hover>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>#</CTableHeaderCell>
            <CTableHeaderCell>Prestazione</CTableHeaderCell>
            <CTableHeaderCell className="text-end">{sortBy === 'count' ? 'N.' : 'Fatturato'}</CTableHeaderCell>
            <CTableHeaderCell>Categoria</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {items.map((p, i) => (
            <CTableRow key={p.id_prestazione || i}>
              <CTableDataCell>{i + 1}</CTableDataCell>
              <CTableDataCell>{p.descrizione}</CTableDataCell>
              <CTableDataCell className="text-end">
                {sortBy === 'count' ? p.count : fmtEur(p.fatturato)}
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color="info" className="text-white">{p.categoria_nome}</CBadge>
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </CCardBody>
  </CCard>
)

const TuttePrestazioniView: React.FC<{ data: ReportPrestazioniAnno }> = ({ data }) => {
  const [sortField, setSortField] = useState<'count' | 'fatturato' | 'ricavo_medio'>('count')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = [...data.per_prestazione].sort((a, b) => {
    const diff = a[sortField] - b[sortField]
    return sortDir === 'desc' ? -diff : diff
  })

  const toggleSort = (field: 'count' | 'fatturato' | 'ricavo_medio') => {
    if (sortField === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortIndicator = (field: string) => sortField === field ? (sortDir === 'desc' ? ' v' : ' ^') : ''

  return (
    <CCard className="mb-4">
      <CCardHeader><strong>Tutte le Prestazioni ({data.per_prestazione.length})</strong></CCardHeader>
      <CCardBody>
        <CTable striped hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Prestazione</CTableHeaderCell>
              <CTableHeaderCell>Categoria</CTableHeaderCell>
              <CTableHeaderCell className="text-end" style={{ cursor: 'pointer' }} onClick={() => toggleSort('count')}>
                N.{sortIndicator('count')}
              </CTableHeaderCell>
              <CTableHeaderCell className="text-end" style={{ cursor: 'pointer' }} onClick={() => toggleSort('fatturato')}>
                Fatturato{sortIndicator('fatturato')}
              </CTableHeaderCell>
              <CTableHeaderCell className="text-end" style={{ cursor: 'pointer' }} onClick={() => toggleSort('ricavo_medio')}>
                Media{sortIndicator('ricavo_medio')}
              </CTableHeaderCell>
              <CTableHeaderCell className="text-end">Tariffario</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {sorted.map((p) => (
              <CTableRow key={p.id_prestazione}>
                <CTableDataCell>{p.descrizione}</CTableDataCell>
                <CTableDataCell><CBadge color="info" className="text-white">{p.categoria_nome}</CBadge></CTableDataCell>
                <CTableDataCell className="text-end">{p.count}</CTableDataCell>
                <CTableDataCell className="text-end">{fmtEur(p.fatturato)}</CTableDataCell>
                <CTableDataCell className="text-end">{fmtEur(p.ricavo_medio)}</CTableDataCell>
                <CTableDataCell className="text-end">{p.prezzo_tariffario > 0 ? fmtEur(p.prezzo_tariffario) : '-'}</CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
}

export default ReportPrestazioni
