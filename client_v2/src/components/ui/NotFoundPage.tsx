import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CCard, CCardBody, CButton } from '@coreui/react'
import { cilHome, cilArrowLeft } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className='d-flex justify-content-center align-items-center min-vh-100 bg-light'>
      <CCard style={{ maxWidth: '500px', width: '100%' }} className='text-center'>
        <CCardBody className='p-5'>
          <div className='mb-4'>
            <h1 className='display-1 text-muted'>404</h1>
            <h3 className='text-muted mb-3'>Pagina non trovata</h3>
            <p className='text-muted'>
              La pagina che stai cercando non esiste o è stata spostata.
            </p>
          </div>

          <div className='d-flex gap-2 justify-content-center'>
            <CButton color='primary' onClick={() => navigate('/dashboard')}>
              <CIcon icon={cilHome} className='me-1' />
              Dashboard
            </CButton>
            <CButton color='secondary' variant='outline' onClick={() => navigate(-1)}>
              <CIcon icon={cilArrowLeft} className='me-1' />
              Indietro
            </CButton>
          </div>
        </CCardBody>
      </CCard>
    </div>
  )
}

export default NotFoundPage