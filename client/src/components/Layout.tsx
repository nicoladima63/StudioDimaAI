// src/components/Layout.tsx
import React from 'react'
import { CContainer, CRow, CCol } from '@coreui/react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

type LayoutProps = {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Navbar />
      <CRow className="g-0">
        <CCol xs={2}>
          <Sidebar />
        </CCol>
        <CCol xs={10} className="p-4">
          <CContainer fluid>{children}</CContainer>
        </CCol>
      </CRow>
    </>
  )
}

export default Layout
