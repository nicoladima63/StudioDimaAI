import React from 'react'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'

interface DashboardCardProps {
  title: string
  children: React.ReactNode
  headerAction?: React.ReactNode
}

const DashboardCard: React.FC<DashboardCardProps> = ({ 
  title, 
  children, 
  headerAction 
}) => {
  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <h4 className="mb-0">{title}</h4>
        {headerAction && headerAction}
      </CCardHeader>
      <CCardBody>{children}</CCardBody>
    </CCard>
  )
}

export default DashboardCard
