import React from 'react'
import {
  CButton,
  CSpinner,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

import PageLayout from '@/components/layout/PageLayout'

interface PageTemplateProps {
  title: string
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  refreshLoading?: boolean
  headerActions?: React.ReactNode
  filters?: React.ReactNode
  stats?: React.ReactNode
  sidePanel?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

const PageTemplate: React.FC<PageTemplateProps> = ({
  title,
  loading = false,
  error = null,
  onRefresh,
  refreshLoading = false,
  headerActions,
  filters,
  stats,
  sidePanel,
  footer,
  children,
}) => {
  return (
    <PageLayout>
      <PageLayout.Header
        title={title}
        headerAction={
          <div className="d-flex gap-2">

            {headerActions}

            {onRefresh && (
              <CButton
                color="primary"
                onClick={onRefresh}
                disabled={refreshLoading}
              >
                {refreshLoading ? (
                  <>
                    <CSpinner size="sm" className="me-2" />
                    Caricamento...
                  </>
                ) : (
                  <>
                    <CIcon icon={cilReload} className="me-2" />
                    Aggiorna
                  </>
                )}
              </CButton>
            )}

          </div>
        }
      />

      {(filters || stats || sidePanel) && (
        <PageLayout.ContentHeader>

          <div className="row">

            <div className="col-md-6">
              {filters}
            </div>

            <div className="col-md-3">
              {stats}
            </div>

            <div className="col-md-3">
              {sidePanel}
            </div>

          </div>

        </PageLayout.ContentHeader>
      )}

      <PageLayout.ContentBody>

        {error ? (
          <CAlert color="danger">
            {error}
          </CAlert>
        ) : loading ? (
          <div className="text-center py-5">
            <CSpinner />
          </div>
        ) : (
          children
        )}

      </PageLayout.ContentBody>

      {footer && (
        <PageLayout.Footer text={footer} />
      )}

    </PageLayout>
  )
}

export default PageTemplate