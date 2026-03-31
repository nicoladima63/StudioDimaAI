import React, { useState, useEffect, useCallback } from 'react';
import {
  CCard, CCardHeader, CCardBody,
  CButton, CFormInput, CFormSelect, CInputGroup, CInputGroupText,
  CRow, CCol, CSpinner, CBadge,
  CAccordion, CAccordionItem, CAccordionHeader, CAccordionBody,
  CProgress,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSearch } from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import { seoService } from '@/features/seo/services/seoService';
import type { SeoAuditResult, SeoIssue, CompetitorResult, CorrectionItem, SavedAudit } from '@/features/seo/services/seoService';

const severityColor = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'danger';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'secondary';
    default: return 'light';
  }
};

const severityLabel = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'Urgente';
    case 'high': return 'Importante';
    case 'medium': return 'Consigliato';
    case 'low': return 'Opzionale';
    default: return severity;
  }
};

const scoreColor = (score: number): string => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
};

const SeoPage: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SeoAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Competitor state
  const [keywords, setKeywords] = useState('');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorReport, setCompetitorReport] = useState<CompetitorResult | null>(null);
  const [competitorError, setCompetitorError] = useState<string | null>(null);

  // Saved audits
  const [savedAudits, setSavedAudits] = useState<SavedAudit[]>([]);

  const loadSavedAudits = useCallback(async () => {
    try {
      const audits = await seoService.apiListAudits();
      setSavedAudits(audits);
      // Default: studiodimartino.eu se presente
      if (audits.length > 0 && !competitorDomain) {
        const myAudit = audits.find(a => a.domain === 'studiodimartino.eu');
        setCompetitorDomain(myAudit ? myAudit.domain : '');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadSavedAudits();
  }, [loadSavedAudits]);

  const buildFullUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  };

  const handleAudit = async () => {
    const siteUrl = url.trim();
    if (!siteUrl) return;

    setLoading(true);
    setError(null);
    setReport(null);
    setCompetitorReport(null);

    try {
      const result = await seoService.apiRunAudit(buildFullUrl(siteUrl));
      if (result && result.success !== false) {
        setReport(result);
        loadSavedAudits();
      } else {
        setError(result?.error || 'Errore durante l\'audit SEO');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Errore durante l\'audit SEO');
    } finally {
      setLoading(false);
    }
  };

  const handleCompetitorAnalysis = async () => {
    if (!keywords.trim() || !competitorDomain) return;

    setCompetitorLoading(true);
    setCompetitorError(null);
    setCompetitorReport(null);

    try {
      const result = await seoService.apiCompetitorAnalysis(competitorDomain, keywords.trim());
      if (result && result.success !== false) {
        setCompetitorReport(result);
      } else {
        setCompetitorError(result?.error || 'Errore durante l\'analisi competitor');
      }
    } catch (e: any) {
      setCompetitorError(e?.response?.data?.message || e?.message || 'Errore durante l\'analisi competitor');
    } finally {
      setCompetitorLoading(false);
    }
  };

  const handleLoadSavedAudit = async (domain: string) => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await seoService.apiLoadAudit(domain);
      if (result && result.success !== false) {
        setReport(result);
      } else {
        setError(result?.error || 'Errore nel caricamento audit');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Errore nel caricamento audit');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleAudit();
  };

  const handleKeywordsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !competitorLoading && keywords.trim() && competitorDomain) handleCompetitorAnalysis();
  };

  return (
    <PageLayout>
      <PageLayout.Header title="SEO Audit" />

      <PageLayout.ContentBody>

        {/* Error */}
        {error && (
          <CCard className="mb-4 border-danger">
            <CCardBody className="text-danger">{error}</CCardBody>
          </CCard>
        )}

        {/* Loading */}
        {loading && (
          <CCard className="mb-4">
            <CCardBody className="text-center py-5">
              <CSpinner color="primary" />
              <p className="mt-3 text-muted">Analisi SEO in corso...</p>
            </CCardBody>
          </CCard>
        )}

        {/* Two columns: Audit | Competitors */}
        <CRow>
          {/* LEFT COLUMN - Audit Results */}
          <CCol xl={6}>

            {/* URL Input - full width */}
            <CCard className="mb-4">
              <CCardHeader>
                <h5 className="mb-0">Analisi di un sito</h5>
              </CCardHeader>
              <CCardBody>
                {savedAudits.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Audit salvati</label>
                    <CFormSelect
                      onChange={(e) => {
                        if (e.target.value) handleLoadSavedAudit(e.target.value);
                      }}
                      disabled={loading}
                    >
                      <option value="">Carica un audit precedente...</option>
                      {savedAudits.map((a) => (
                        <option key={a.domain} value={a.domain}>
                          {a.domain} ({a.score}/100 - {a.timestamp ? new Date(a.timestamp).toLocaleDateString('it-IT') : ''})
                        </option>
                      ))}
                    </CFormSelect>
                  </div>
                )}
                <label className="form-label fw-semibold">Nuovo audit</label>
                <CRow className="align-items-end">
                  <CCol md={9} lg={10}>
                    <CInputGroup>
                      <CInputGroupText>https://</CInputGroupText>
                      <CFormInput
                        placeholder="studiodimartino.eu"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading || competitorLoading}
                      />
                    </CInputGroup>
                  </CCol>
                  <CCol md={3} lg={2} className="mt-2 mt-md-0">
                    <CButton
                      color="primary"
                      className="w-100"
                      onClick={handleAudit}
                      disabled={loading || competitorLoading || !url.trim()}
                    >
                      {loading ? (
                        <><CSpinner size="sm" className="me-2" /> Analisi...</>
                      ) : (
                        <><CIcon icon={cilSearch} className="me-1" /> Avvia Audit</>
                      )}
                    </CButton>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>


            {report && !loading && (
              <>
                {/* Score Overview */}
                <CCard className="mb-4">
                  <CCardHeader>
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">Risultato Audit</h5>
                      <span className="text-muted small">Tempo: {report.elapsed_seconds}s</span>
                    </div>
                  </CCardHeader>
                  <CCardBody>
                    <div className="text-center mb-4">
                      <h1 className={`display-3 fw-bold text-${scoreColor(report.overall_score)}`}>
                        {report.overall_score}/100
                      </h1>
                      <CBadge color={scoreColor(report.overall_score)} className="fs-6 px-3 py-2">
                        {report.score_label}
                      </CBadge>
                      <p className="text-muted mt-2">{report.url}</p>
                    </div>

                    {/* Issues summary */}
                    {report.issues_summary && (
                      <div className="d-flex justify-content-center gap-3 mb-4">
                        {Object.entries(report.issues_summary).map(([severity, count]) => (
                          <CBadge key={severity} color={severityColor(severity)} className="px-3 py-2">
                            {severity.toUpperCase()}: {count}
                          </CBadge>
                        ))}
                      </div>
                    )}

                    {/* Category scores */}
                    {report.categories && (
                      <CRow className="g-3">
                        {Object.entries(report.categories).map(([key, cat]) => (
                          <CCol key={key} sm={6} xl={4}>
                            <div className="border rounded p-3 h-100">
                              <div className="d-flex justify-content-between mb-2">
                                <strong className="small">{cat.label}</strong>
                                <span className={`small fw-bold text-${scoreColor(cat.score)}`}>
                                  {cat.score}/100
                                </span>
                              </div>
                              <CProgress
                                value={cat.score}
                                color={scoreColor(cat.score)}
                                className="mb-1"
                                style={{ height: '6px' }}
                              />
                              <small className="text-muted">
                                Peso: {cat.weight} - {cat.issues_count} problemi
                              </small>
                            </div>
                          </CCol>
                        ))}
                      </CRow>
                    )}
                  </CCardBody>
                </CCard>

                {/* Quick Wins */}
                {report.quick_wins && report.quick_wins.length > 0 && (
                  <CCard className="mb-4">
                    <CCardHeader><h5 className="mb-0">Quick Wins</h5></CCardHeader>
                    <CCardBody>
                      {report.quick_wins.map((issue, i) => (
                        <IssueRow key={i} issue={issue} />
                      ))}
                    </CCardBody>
                  </CCard>
                )}

                {/* Issues by Category */}
                {report.categories && (
                  <CCard className="mb-4">
                    <CCardHeader><h5 className="mb-0">Dettaglio per Categoria</h5></CCardHeader>
                    <CCardBody>
                      <CAccordion>
                        {Object.entries(report.categories).map(([key, cat]) => {
                          const catIssues = report.issues.filter(i => i.category === cat.label);
                          return (
                            <CAccordionItem key={key} itemKey={key}>
                              <CAccordionHeader>
                                <div className="d-flex align-items-center gap-2 w-100 me-3">
                                  <strong>{cat.label}</strong>
                                  <CBadge color={scoreColor(cat.score)}>{cat.score}/100</CBadge>
                                  {catIssues.length > 0 && (
                                    <CBadge color="secondary">{catIssues.length} problemi</CBadge>
                                  )}
                                </div>
                              </CAccordionHeader>
                              <CAccordionBody>
                                {catIssues.length > 0 ? (
                                  catIssues.map((issue, i) => <IssueRow key={i} issue={issue} />)
                                ) : (
                                  <p className="text-success mb-0">Nessun problema rilevato</p>
                                )}
                                {cat.data && Object.keys(cat.data).length > 0 && (
                                  <div className="mt-3 pt-3 border-top">
                                    <small className="fw-semibold text-muted d-block mb-2">Dati rilevati:</small>
                                    <pre className="bg-light p-3 rounded small mb-0" style={{ maxHeight: '300px', overflow: 'auto' }}>
                                      {JSON.stringify(cat.data, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </CAccordionBody>
                            </CAccordionItem>
                          );
                        })}
                      </CAccordion>
                    </CCardBody>
                  </CCard>
                )}

                {/* Full JSON */}
                <CCard className="mb-4 d-none">
                  <CCardHeader><h5 className="mb-0">Report JSON Completo</h5></CCardHeader>
                  <CCardBody>
                    <pre className="bg-light p-3 rounded" style={{ maxHeight: '500px', overflow: 'auto', fontSize: '0.8rem' }}>
                      {JSON.stringify(report, null, 2)}
                    </pre>
                  </CCardBody>
                </CCard>
              </>
            )}
          </CCol>

          {/* RIGHT COLUMN - Competitor Analysis */}
          <CCol xl={6}>
            {/* Keywords Input */}
            <CCard className="mb-4">
              <CCardHeader>
                <h5 className="mb-0">Analisi Competitor</h5>
              </CCardHeader>
              <CCardBody>
                <label className="form-label fw-semibold">Confronta con</label>
                <CFormSelect
                  value={competitorDomain}
                  onChange={(e) => {
                    setCompetitorDomain(e.target.value);
                    // Rilancia analisi se ci sono keywords
                    if (e.target.value && keywords.trim()) {
                      setTimeout(() => {
                        const domain = e.target.value;
                        setCompetitorLoading(true);
                        setCompetitorError(null);
                        setCompetitorReport(null);
                        seoService.apiCompetitorAnalysis(domain, keywords.trim())
                          .then(result => {
                            if (result && result.success !== false) {
                              setCompetitorReport(result);
                            } else {
                              setCompetitorError(result?.error || 'Errore durante l\'analisi competitor');
                            }
                          })
                          .catch((err: any) => {
                            setCompetitorError(err?.response?.data?.message || err?.message || 'Errore durante l\'analisi competitor');
                          })
                          .finally(() => setCompetitorLoading(false));
                      }, 0);
                    }
                  }}
                  disabled={competitorLoading || savedAudits.length === 0}
                  className="mb-3"
                >
                  <option value="">
                    {savedAudits.length === 0 ? 'Nessun audit salvato' : 'Seleziona un audit...'}
                  </option>
                  {savedAudits.map((a) => (
                    <option key={a.domain} value={a.domain}>
                      {a.domain} ({a.score}/100 - {a.score_label})
                    </option>
                  ))}
                </CFormSelect>

                <label className="form-label fw-semibold">Parole chiave</label>
                <CFormInput
                  placeholder="es. dentista roma, studio odontoiatrico..."
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  onKeyDown={handleKeywordsKeyDown}
                  disabled={competitorLoading}
                  className="mb-3"
                />
                <CButton
                  color="info"
                  className="w-100"
                  onClick={handleCompetitorAnalysis}
                  disabled={competitorLoading || !keywords.trim() || !competitorDomain}
                >
                  {competitorLoading ? (
                    <><CSpinner size="sm" className="me-2" /> Ricerca e analisi...</>
                  ) : (
                    <><CIcon icon={cilSearch} className="me-1" /> Cerca e Confronta</>
                  )}
                </CButton>
              </CCardBody>
            </CCard>

            {/* Competitor Error */}
            {competitorError && (
              <CCard className="mb-4 border-danger">
                <CCardBody className="text-danger small">{competitorError}</CCardBody>
              </CCard>
            )}

            {/* Competitor Loading */}
            {competitorLoading && (
              <CCard className="mb-4">
                <CCardBody className="text-center py-4">
                  <CSpinner color="info" />
                  <p className="mt-3 text-muted small">Ricerca competitor e analisi in corso...</p>
                </CCardBody>
              </CCard>
            )}

            {/* Competitor Results */}
            {competitorReport && !competitorLoading && (
              <>
                {/* Competitor found */}
                <CCard className="mb-4">
                  <CCardHeader>
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">Competitor Trovati</h5>
                      <small className="text-muted">
                        {competitorReport.analyzed} analizzati
                        {competitorReport.failed > 0 && `, ${competitorReport.failed} falliti`}
                      </small>
                    </div>
                  </CCardHeader>
                  {competitorReport.my_position && (
                    <div className="bg-light px-3 py-2 border-bottom">
                      <small className="text-success fw-semibold">
                        Il tuo sito compare in posizione {competitorReport.my_position} su Google Maps
                      </small>
                    </div>
                  )}
                  <CCardBody>
                    {competitorReport.warning && (
                      <div className="text-warning small mb-3">{competitorReport.warning}</div>
                    )}
                    {competitorReport.competitors.map((comp, i) => (
                      <div key={i} className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                        <a href={comp.url} target="_blank" rel="noopener noreferrer" className="small text-truncate" style={{ maxWidth: '65%' }} title={comp.url}>
                          {comp.url}
                        </a>
                        {comp.error ? (
                          <CBadge color="danger">Errore</CBadge>
                        ) : (
                          <CBadge color={scoreColor(comp.score!)} className="px-2">
                            {comp.score}/100
                          </CBadge>
                        )}
                      </div>
                    ))}
                  </CCardBody>
                </CCard>

                {/* Corrections - the main output */}
                {competitorReport.corrections.length > 0 ? (
                  <CCard className="mb-4">
                    <CCardHeader>
                      <h5 className="mb-0">Azioni Correttive</h5>
                    </CCardHeader>
                    <CCardBody>
                      {competitorReport.corrections.map((correction, i) => (
                        <CorrectionRow key={i} correction={correction} />
                      ))}
                    </CCardBody>
                  </CCard>
                ) : (
                  <CCard className="mb-4 border-success">
                    <CCardBody className="text-success text-center py-4">
                      <strong>Nessuna azione correttiva necessaria.</strong>
                      <p className="mb-0 mt-1 small">Il tuo sito performa meglio o uguale ai competitor per tutte le metriche.</p>
                    </CCardBody>
                  </CCard>
                )}

              </>
            )}
          </CCol>
        </CRow>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

const IssueRow: React.FC<{ issue: SeoIssue }> = ({ issue }) => (
  <div className="d-flex align-items-start gap-2 mb-2 pb-2 border-bottom">
    <CBadge color={severityColor(issue.severity)} className="mt-1" style={{ minWidth: '70px' }}>
      {issue.severity.toUpperCase()}
    </CBadge>
    <div>
      <span className="small">{issue.message}</span>
      {issue.recommendation && (
        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{issue.recommendation}</div>
      )}
    </div>
  </div>
);

const CorrectionRow: React.FC<{ correction: CorrectionItem }> = ({ correction }) => (
  <div className="mb-4 pb-3 border-bottom">
    <div className="d-flex align-items-start gap-2 mb-2">
      <CBadge color={severityColor(correction.severity)} className="mt-1" style={{ minWidth: '85px' }}>
        {severityLabel(correction.severity)}
      </CBadge>
      <strong className="small">{correction.action}</strong>
    </div>
    <div className="ms-5">
      <div className="small text-muted mb-1">{correction.reason}</div>
      {correction.example && (
        <div className="small fst-italic" style={{ fontSize: '0.8rem' }}>{correction.example}</div>
      )}
    </div>
  </div>
);

export default SeoPage;
