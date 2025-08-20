import React from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CBadge,
  CAlert,
} from '@coreui/react'
import { cilSpeedometer, cilPeople, cilLayers, cilChart } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

import { useAuthStore } from '@/store/auth.store'
import { config } from '@/utils'

const Dashboard: React.FC = () => {
  const { user } = useAuthStore()

  const stats = [
    {
      title: 'Fornitori',
      value: '-',
      icon: cilPeople,
      color: 'primary',
      description: 'Gestione fornitori',
    },
    {
      title: 'Materiali',
      value: '-',
      icon: cilLayers,
      color: 'success',
      description: 'Catalogo materiali',
    },
    {
      title: 'Statistiche',
      value: '-',
      icon: cilChart,
      color: 'warning',
      description: 'Analytics e report',
    },
    {
      title: 'Sistema',
      value: 'V2.0',
      icon: cilSpeedometer,
      color: 'info',
      description: 'Versione sistema',
    },
  ]

  return (
    <div className='fade-in'>
      {/* Welcome header */}
      <CRow className='mb-4'>
        <CCol>
          <h1 className='h2 mb-2'>
            Benvenuto, {user?.username}!
          </h1>
          <p className='text-muted mb-0'>
            Panoramica del sistema Studio Dima V2 - Ultima connessione oggi
          </p>
        </CCol>
      </CRow>

      {/* Stats cards */}
      <CRow className='mb-4'>
        {stats.map((stat, index) => (
          <CCol key={index} sm={6} lg={3} className='mb-3'>
            <CCard className='h-100'>
              <CCardBody>
                <div className='d-flex align-items-center'>
                  <div className='me-3'>
                    <div
                      className={`bg-${stat.color} text-white rounded-circle d-flex align-items-center justify-content-center`}
                      style={{ width: '48px', height: '48px' }}
                    >
                      <CIcon icon={stat.icon} size='lg' />
                    </div>
                  </div>
                  <div className='flex-grow-1'>
                    <div className='h5 mb-1'>{stat.value}</div>
                    <div className='small text-muted'>{stat.title}</div>
                    <div className='small text-muted'>{stat.description}</div>
                  </div>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Info sections */}
      <CRow>
        <CCol lg={8}>
          <CCard className='mb-4'>
            <CCardHeader>
              <h5 className='mb-0'>Studio Dima V2 - Novità</h5>
            </CCardHeader>
            <CCardBody>
              <CAlert color='info' className='mb-3'>
                <strong>Nuova architettura!</strong> Il sistema è stato completamente riprogettato con tecnologie moderne.
              </CAlert>
              
              <h6>Miglioramenti principali:</h6>
              <ul className='mb-3'>
                <li><strong>Performance:</strong> Caricamento più veloce e interfaccia reattiva</li>
                <li><strong>TypeScript:</strong> Codice più sicuro e manutenibile</li>
                <li><strong>API V2:</strong> Nuove API ottimizzate per migliori prestazioni</li>
                <li><strong>UI moderna:</strong> Interfaccia aggiornata con CoreUI V5</li>
                <li><strong>Architettura modulare:</strong> Sistema organizzato per feature</li>
              </ul>

              <div className='d-flex gap-2 flex-wrap'>
                <CBadge color='primary'>React 18</CBadge>
                <CBadge color='success'>TypeScript</CBadge>
                <CBadge color='warning'>Vite</CBadge>
                <CBadge color='info'>CoreUI V5</CBadge>
                <CBadge color='danger'>Zustand</CBadge>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol lg={4}>
          <CCard className='mb-4'>
            <CCardHeader>
              <h6 className='mb-0'>Informazioni Sistema</h6>
            </CCardHeader>
            <CCardBody>
              <div className='small mb-2'>
                <strong>Versione:</strong> {config.app.version}
              </div>
              <div className='small mb-2'>
                <strong>Ambiente:</strong> {config.app.environment}
              </div>
              <div className='small mb-2'>
                <strong>API Server:</strong> V2 (http://localhost:5001)
              </div>
              <div className='small mb-2'>
                <strong>Utente:</strong> {user?.username} ({user?.role})
              </div>
              <div className='small text-muted'>
                <strong>Ultima build:</strong> {new Date().toLocaleDateString('it-IT')}
              </div>
            </CCardBody>
          </CCard>

          <CCard>
            <CCardHeader>
              <h6 className='mb-0'>Prossimi sviluppi</h6>
            </CCardHeader>
            <CCardBody>
              <div className='small mb-2'>
                🔄 <strong>Migrazione features V1</strong>
              </div>
              <div className='small mb-2'>
                📊 <strong>Dashboard analytics</strong>
              </div>
              <div className='small mb-2'>
                🏗️ <strong>Nuove funzionalità</strong>
              </div>
              <div className='small mb-2'>
                🔧 <strong>Ottimizzazioni performance</strong>
              </div>
              <div className='small text-muted'>
                <strong>Timeline:</strong> Q1 2025
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}

export default Dashboard