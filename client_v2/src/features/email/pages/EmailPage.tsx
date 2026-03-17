import React, { useState, useEffect, useCallback } from 'react'
import {
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CRow,
  CCol,
  CAlert,
} from '@coreui/react'
import PageLayout from '@/components/layout/PageLayout'
import EmailList from '../components/EmailList'
import EmailDetail from '../components/EmailDetail'
import EmailScopeFilter from '../components/EmailScopeFilter'
import EmailScopesManager from '../components/EmailScopesManager'
import EmailRulesManager from '../components/EmailRulesManager'
import EmailAiConfig from '../components/EmailAiConfig'
import EmailOAuthSetup from '../components/EmailOAuthSetup'
import { useEmailStore } from '../store/email.store'
import type { EmailMessage } from '../types/email.types'
import type { RulePreset } from '../components/EmailDetail'

const FILTER_UNCLASSIFIED = -1

const EmailPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [rulePreset, setRulePreset] = useState<{ field: string; operator: string; value: string } | null>(null)

  const {
    authenticated,
    relevantEmails,
    scopes,
    loadingRelevant,
    relevantNextPageToken,
    error,
    searchQuery,
    selectedScopeIds,
    checkAuth,
    fetchRelevantEmails,
    fetchScopes,
    setSearchQuery,
    setSelectedScopeIds,
    clearError,
  } = useEmailStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (authenticated) {
      fetchScopes()
    }
  }, [authenticated, fetchScopes])

  const [initialLoadDone, setInitialLoadDone] = useState(false)

  useEffect(() => {
    if (!authenticated || initialLoadDone) return
    if (activeTab === 0) {
      fetchRelevantEmails(true)
      setInitialLoadDone(true)
    }
  }, [activeTab, authenticated])

  const handleSelectEmail = (email: EmailMessage) => {
    setSelectedEmail(email)
    setDetailVisible(true)
  }

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      fetchRelevantEmails(true)
    },
    [setSearchQuery, fetchRelevantEmails]
  )

  const handleCreateRuleFromEmail = useCallback(
    (presets: RulePreset[]) => {
      if (presets.length > 0) {
        setRulePreset(presets[0])
        setDetailVisible(false)
        setActiveTab(1) // Switch to Scopi e Regole tab
      }
    },
    []
  )

  const handleScopeFilterChange = useCallback(
    (ids: number[]) => {
      setSelectedScopeIds(ids)
    },
    [setSelectedScopeIds]
  )

  // Filter emails locally by selected scopes
  const filteredEmails = selectedScopeIds.length === 0
    ? relevantEmails
    : selectedScopeIds.includes(FILTER_UNCLASSIFIED)
      ? relevantEmails.filter((e) => !e.classification)
      : relevantEmails.filter(
          (e) => e.classification && selectedScopeIds.includes(e.classification.scope_id)
        )

  const classifiedCount = relevantEmails.filter((e) => e.classification).length
  const unclassifiedCount = relevantEmails.length - classifiedCount

  if (!authenticated) {
    return (
      <PageLayout>
        <PageLayout.Header title="Email">
          <small className="text-muted">Lettore email intelligente con filtro per pertinenza</small>
        </PageLayout.Header>
        <PageLayout.Content>
          <div className="card-body">
            <CRow>
              <CCol md={6} className="mx-auto">
                <EmailOAuthSetup />
              </CCol>
            </CRow>
          </div>
        </PageLayout.Content>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageLayout.Header title="Email">
        <small className="text-muted">Lettore email intelligente con filtro per pertinenza</small>
      </PageLayout.Header>
      <PageLayout.Content>
        <div className="card-body">
          {error && (
            <CAlert color="danger" dismissible onClose={clearError}>
              {error}
            </CAlert>
          )}

          <CNav variant="tabs" className="mb-3">
            <CNavItem>
              <CNavLink
                active={activeTab === 0}
                onClick={() => setActiveTab(0)}
                style={{ cursor: 'pointer' }}
              >
                Email
                {relevantEmails.length > 0 && (
                  <span className="ms-1 badge bg-primary">{relevantEmails.length}</span>
                )}
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === 1}
                onClick={() => setActiveTab(1)}
                style={{ cursor: 'pointer' }}
              >
                Scopi e Regole
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === 2}
                onClick={() => setActiveTab(2)}
                style={{ cursor: 'pointer' }}
              >
                Configurazione
              </CNavLink>
            </CNavItem>
          </CNav>

          <CTabContent>
            {/* Tab: Email */}
            <CTabPane visible={activeTab === 0}>
              <div className="mb-3">
                <EmailScopeFilter
                  scopes={scopes}
                  selectedIds={selectedScopeIds}
                  onChange={handleScopeFilterChange}
                  unclassifiedCount={unclassifiedCount}
                />
              </div>
              <EmailList
                emails={filteredEmails}
                loading={loadingRelevant}
                hasMore={!!relevantNextPageToken}
                onLoadMore={() => fetchRelevantEmails(false)}
                onRefresh={() => fetchRelevantEmails(true)}
                onSelectEmail={handleSelectEmail}
                onSearch={handleSearch}
                searchQuery={searchQuery}
                showClassification
              />
            </CTabPane>

            {/* Tab: Scopi e Regole */}
            <CTabPane visible={activeTab === 1}>
              <CRow className="g-4">
                <CCol xs={12}>
                  <EmailScopesManager />
                </CCol>
                <CCol xs={12}>
                  <EmailRulesManager
                    preset={rulePreset}
                    onPresetConsumed={() => setRulePreset(null)}
                  />
                </CCol>
              </CRow>
            </CTabPane>

            {/* Tab: Configurazione */}
            <CTabPane visible={activeTab === 2}>
              <CRow className="g-4">
                <CCol md={6}>
                  <EmailOAuthSetup />
                </CCol>
                <CCol md={6}>
                  <EmailAiConfig />
                </CCol>
              </CRow>
            </CTabPane>
          </CTabContent>
        </div>
      </PageLayout.Content>

      {/* Email Detail Modal */}
      <EmailDetail
        email={selectedEmail}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onCreateRule={handleCreateRuleFromEmail}
      />
    </PageLayout>
  )
}

export default EmailPage
