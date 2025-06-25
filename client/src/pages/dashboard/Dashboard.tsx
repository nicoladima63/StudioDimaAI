// src/pages/Dashboard.tsx
import React from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
} from '@coreui/react'
import Layout from '@/components/Layout'

const Dashboard: React.FC = () => {


  return (
    <Layout>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Dashboard</h4>
        </CCardHeader>
        <CCardBody>
          <p>Benvenuto nella dashboard.</p>
        </CCardBody>
      </CCard>
    </Layout>
  )
}

export default Dashboard
