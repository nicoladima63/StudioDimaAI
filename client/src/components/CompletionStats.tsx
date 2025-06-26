import React from 'react'
import { CCard, CCardHeader, CCardBody, CProgress } from '@coreui/react'

const CompletionStats: React.FC = () => {
  return (
    <CCard>
      <CCardHeader>Stato completamento</CCardHeader>
      <CCardBody>
        <h6>Task completati: 65%</h6>
        <CProgress className="mb-3" color="success" value={65} />
        <h6>Appuntamenti confermati: 80%</h6>
        <CProgress className="mb-3" color="info" value={80} />
        <h6>Pagamenti ricevuti: 45%</h6>
        <CProgress className="mb-3" color="warning" value={45} />
      </CCardBody>
    </CCard>
  )
}

export default CompletionStats
