import React from 'react'
import { CCard, CCardHeader, CCardBody } from '@coreui/react'
import { CChart } from '@coreui/react-chartjs'

const MonthlyChart: React.FC = () => {
  return (
    <CCard>
      <CCardHeader>Andamento mensile</CCardHeader>
      <CCardBody>
        <CChart
          type="line"
          data={{
            labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'],
            datasets: [
              {
                label: 'Appuntamenti',
                backgroundColor: 'rgba(0, 123, 255, 0.2)',
                borderColor: 'rgba(0, 123, 255, 1)',
                pointBackgroundColor: 'rgba(0, 123, 255, 1)',
                pointHoverBackgroundColor: '#fff',
                data: [65, 59, 80, 81, 56, 55]
              }
            ]
          }}
        />
      </CCardBody>
    </CCard>
  )
}

export default MonthlyChart