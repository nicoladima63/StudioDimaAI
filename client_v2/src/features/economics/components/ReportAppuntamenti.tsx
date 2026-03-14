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
import type { ReportAppuntamentiData, ReportAppuntamentiAnno } from '../types'

const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const COLORI = ['#321fdb', '#2eb85c', '#f9b115', '#e55353', '#3399ff', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#e74c3c', '#2ecc71', '#95a5a6']

const currentYear = new Date().getFullYear()
const ANNI_DISPONIBILI = Array.from({ length: 5 }, (_, i) => currentYear - i)

const ReportAppuntamenti: React.FC = () => {
  const [data, setData] = useState<ReportAppuntamentiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [annoSelezionato, setAnnoSelezionato] = useState<number>(currentYear)
  const [annoConfronto, setAnnoConfronto] = useState<number | null>(null)
  const [subTab, setSubTab] = useState<string>('tipo')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const anni = annoConfronto ? [annoConfronto, annoSelezionato] : undefined
      const anno = annoConfronto ? undefined : annoSelezionato
      const res = await economicsService.apiGetReportAppuntamenti(anno, anni)
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
            <CBadge color="primary" className="me-2 fs-6">{annoData.totale_appuntamenti} appuntamenti</CBadge>
            <CBadge color="success" className="fs-6">{annoData.totale_ore_cliniche} ore cliniche</CBadge>
          </div>
        </CCol>
      </CRow>

      {/* Sub-tabs */}
      <CNav variant="pills" className="mb-3">
        {[
          { key: 'tipo', label: 'Per Tipo' },
          { key: 'medico', label: 'Per Medico' },
          { key: 'studio', label: 'Per Studio' },
          { key: 'trend', label: 'Trend Mensile' },
        ].map((t) => (
          <CNavItem key={t.key}>
            <CNavLink active={subTab === t.key} onClick={() => setSubTab(t.key)} style={{ cursor: 'pointer' }}>
              {t.label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>

      <CTabContent>
        {/* Per Tipo */}
        <CTabPane visible={subTab === 'tipo'}>
          <CRow>
            <CCol lg={7}>
              <CCard className="mb-4">
                <CCardHeader><strong>Distribuzione per Tipo</strong></CCardHeader>
                <CCardBody>
                  <CTable striped hover responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Tipo</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">N. App.</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">%</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Ore</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Durata Media</CTableHeaderCell>
                        {confronto && <CTableHeaderCell className="text-end">Delta</CTableHeaderCell>}
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {annoData.per_tipo.map((t) => {
                        const delta = confronto?.delta_per_tipo.find((d) => d.tipo === t.tipo)
                        return (
                          <CTableRow key={t.tipo}>
                            <CTableDataCell><strong>{t.tipo_nome}</strong></CTableDataCell>
                            <CTableDataCell className="text-end">{t.num_appuntamenti}</CTableDataCell>
                            <CTableDataCell className="text-end">{t.percentuale}%</CTableDataCell>
                            <CTableDataCell className="text-end">{t.ore_cliniche}h</CTableDataCell>
                            <CTableDataCell className="text-end">{t.durata_media_minuti} min</CTableDataCell>
                            {confronto && (
                              <CTableDataCell className="text-end">
                                {delta && (
                                  <CBadge color={delta.delta_count > 0 ? 'success' : delta.delta_count < 0 ? 'danger' : 'secondary'}>
                                    {delta.delta_count > 0 ? '+' : ''}{delta.delta_count}
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
                <CCardHeader><strong>Distribuzione %</strong></CCardHeader>
                <CCardBody>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={annoData.per_tipo.map((t) => ({ name: t.tipo_nome, value: t.num_appuntamenti }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {annoData.per_tipo.map((_, i) => <Cell key={i} fill={COLORI[i % COLORI.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        {/* Per Medico */}
        <CTabPane visible={subTab === 'medico'}>
          <PerMedicoView data={annoData} />
        </CTabPane>

        {/* Per Studio */}
        <CTabPane visible={subTab === 'studio'}>
          <CCard className="mb-4">
            <CCardHeader><strong>Distribuzione per Studio</strong></CCardHeader>
            <CCardBody>
              <CRow>
                {annoData.per_studio.map((s) => (
                  <CCol sm={4} key={s.studio}>
                    <CCard className="mb-3 text-center">
                      <CCardBody>
                        <div className="text-uppercase text-body-secondary small">Studio {s.studio}</div>
                        <div className="fs-4 fw-bold">{s.num_appuntamenti}</div>
                        <div className="text-body-secondary">{s.percentuale}% | {s.ore_cliniche}h</div>
                      </CCardBody>
                    </CCard>
                  </CCol>
                ))}
              </CRow>
            </CCardBody>
          </CCard>
        </CTabPane>

        {/* Trend Mensile */}
        <CTabPane visible={subTab === 'trend'}>
          <CCard className="mb-4">
            <CCardHeader><strong>Trend Mensile {annoSelezionato}</strong></CCardHeader>
            <CCardBody>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={annoData.trend_mensile.map((m) => ({
                    mese: MESI_NOMI[m.mese - 1],
                    appuntamenti: m.num_appuntamenti,
                    ore: m.ore_cliniche,
                  }))}
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mese" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="appuntamenti" name="Appuntamenti" fill="#321fdb" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="ore" name="Ore Cliniche" fill="#2eb85c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CCardBody>
          </CCard>
        </CTabPane>
      </CTabContent>
    </>
  )
}

const PerMedicoView: React.FC<{ data: ReportAppuntamentiAnno }> = ({ data }) => (
  <CRow>
    {data.per_medico.map((m) => (
      <CCol lg={6} key={m.medico_id}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>{m.medico_nome}</strong>
            <CBadge color="primary" className="ms-2">{m.num_appuntamenti} app</CBadge>
            <CBadge color="success" className="ms-1">{m.ore_cliniche}h</CBadge>
            <span className="text-body-secondary ms-2">({m.percentuale}%)</span>
          </CCardHeader>
          <CCardBody>
            <CTable small striped>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Tipo</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">N.</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {m.tipi.map((t) => (
                  <CTableRow key={t.tipo}>
                    <CTableDataCell>{t.tipo_nome}</CTableDataCell>
                    <CTableDataCell className="text-end">{t.count}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    ))}
  </CRow>
)

export default ReportAppuntamenti
