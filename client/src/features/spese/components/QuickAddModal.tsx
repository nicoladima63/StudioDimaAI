import React, { useState, useEffect } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CForm,
  CFormLabel,
  CFormSelect,
  CFormInput,
  CAlert,
  CSpinner,
  CRow,
  CCol,
  CBadge,
  CInputGroup,
  CInputGroupText
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSave, cilX, cilPlus, cilArrowRight } from '@coreui/icons'
import apiClient from '@/api/client'

interface Conto {
  id: number
  nome: string
}

interface Branca {
  id: number
  contoid: number
  nome: string
}

interface Sottoconto {
  id: number
  contoid: number
  brancaid: number
  nome: string
}

interface QuickAddModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: (nuovoSottoconto: { 
    contoId: number
    contoNome: string
    brancaId: number
    brancaNome: string
    sottocontoId: number
    sottocontoNome: string
  }) => void
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  // Stati dati
  const [conti, setConti] = useState<Conto[]>([])
  const [branche, setBranche] = useState<Branca[]>([])
  const [brancheDisponibili, setBrancheDisponibili] = useState<Branca[]>([])
  
  // Stati form
  const [step, setStep] = useState(1) // 1=Conto, 2=Branca, 3=Sottoconto
  const [selectedConto, setSelectedConto] = useState<number | null>(null)
  const [selectedBranca, setSelectedBranca] = useState<number | null>(null)
  const [nuovoContoNome, setNuovoContoNome] = useState('')
  const [nuovaBrancaNome, setNuovaBrancaNome] = useState('')
  const [nuovoSottocontoNome, setNuovoSottocontoNome] = useState('')
  
  // Stati UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalStep, setModalStep] = useState<'select' | 'create'>('select')

  useEffect(() => {
    if (visible) {
      caricaConti()
      resetForm()
    }
  }, [visible])

  useEffect(() => {
    if (selectedConto) {
      caricaBranche()
    } else {
      setBrancheDisponibili([])
      setSelectedBranca(null)
    }
  }, [selectedConto])

  const caricaConti = async () => {
    try {
      const response = await apiClient.get('/api/struttura-conti/conti')
      if (response.data.success) {
        setConti(response.data.data)
      }
    } catch (error) {
      console.error('Errore caricamento conti:', error)
    }
  }

  const caricaBranche = async () => {
    try {
      const response = await apiClient.get('/api/struttura-conti/branche')
      if (response.data.success) {
        setBranche(response.data.data)
        setBrancheDisponibili(response.data.data.filter((b: Branca) => b.contoid === selectedConto))
      }
    } catch (error) {
      console.error('Errore caricamento branche:', error)
    }
  }

  const resetForm = () => {
    setStep(1)
    setModalStep('select')
    setSelectedConto(null)
    setSelectedBranca(null)
    setNuovoContoNome('')
    setNuovaBrancaNome('')
    setNuovoSottocontoNome('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const creaNuovoConto = async () => {
    if (!nuovoContoNome.trim()) {
      setError('Nome conto obbligatorio')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const response = await apiClient.post('/api/struttura-conti/conti', {
        nome: nuovoContoNome.trim()
      })
      
      if (response.data.success) {
        const nuovoConto = response.data.data
        setConti(prev => [...prev, nuovoConto])
        setSelectedConto(nuovoConto.id)
        setNuovoContoNome('')
        setModalStep('select')
        setStep(2)
      } else {
        setError(response.data.error)
      }
    } catch (error: any) {
      setError(`Errore creazione conto: ${error.response?.data?.error || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const creaNuovaBranca = async () => {
    if (!nuovaBrancaNome.trim()) {
      setError('Nome branca obbligatorio')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const response = await apiClient.post('/api/struttura-conti/branche', {
        contoid: selectedConto,
        nome: nuovaBrancaNome.trim()
      })
      
      if (response.data.success) {
        const nuovaBranca = response.data.data
        setBranche(prev => [...prev, nuovaBranca])
        setBrancheDisponibili(prev => [...prev, nuovaBranca])
        setSelectedBranca(nuovaBranca.id)
        setNuovaBrancaNome('')
        setModalStep('select')
        setStep(3)
      } else {
        setError(response.data.error)
      }
    } catch (error: any) {
      setError(`Errore creazione branca: ${error.response?.data?.error || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const creaNuovoSottoconto = async () => {
    if (!nuovoSottocontoNome.trim()) {
      setError('Nome sottoconto obbligatorio')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const response = await apiClient.post('/api/struttura-conti/sottoconti', {
        brancaid: selectedBranca,
        nome: nuovoSottocontoNome.trim()
      })
      
      if (response.data.success) {
        const nuovoSottoconto = response.data.data
        const conto = conti.find(c => c.id === selectedConto)
        const branca = brancheDisponibili.find(b => b.id === selectedBranca)
        
        // Chiama callback con i dati completi
        onSuccess({
          contoId: selectedConto!,
          contoNome: conto!.nome,
          brancaId: selectedBranca!,
          brancaNome: branca!.nome,
          sottocontoId: nuovoSottoconto.id,
          sottocontoNome: nuovoSottoconto.nome
        })
        
        handleClose()
      } else {
        setError(response.data.error)
      }
    } catch (error: any) {
      setError(`Errore creazione sottoconto: ${error.response?.data?.error || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="d-flex align-items-center justify-content-center mb-4">
      <CBadge color={step >= 1 ? 'primary' : 'secondary'} className="px-3 py-2">
        1. Conto
      </CBadge>
      <CIcon icon={cilArrowRight} className="mx-2 text-muted" />
      <CBadge color={step >= 2 ? 'success' : 'secondary'} className="px-3 py-2">
        2. Branca
      </CBadge>
      <CIcon icon={cilArrowRight} className="mx-2 text-muted" />
      <CBadge color={step >= 3 ? 'info' : 'secondary'} className="px-3 py-2">
        3. Sottoconto
      </CBadge>
    </div>
  )

  const renderStepContent = () => {
    if (step === 1) {
      return modalStep === 'select' ? (
        <div>
          <CFormLabel>Seleziona Conto Esistente</CFormLabel>
          <CInputGroup className="mb-3">
            <CFormSelect
              value={selectedConto || ''}
              onChange={(e) => {
                const value = e.target.value
                if (value) {
                  setSelectedConto(parseInt(value))
                  setStep(2)
                } else {
                  setSelectedConto(null)
                }
              }}
            >
              <option value="">Seleziona un conto...</option>
              {conti.map(conto => (
                <option key={conto.id} value={conto.id}>{conto.nome}</option>
              ))}
            </CFormSelect>
            <CButton 
              color="primary" 
              variant="outline"
              onClick={() => setModalStep('create')}
            >
              <CIcon icon={cilPlus} />
            </CButton>
          </CInputGroup>
          <div className="text-center">
            <small className="text-muted">oppure crea un nuovo conto</small>
          </div>
        </div>
      ) : (
        <div>
          <CFormLabel>Nuovo Conto</CFormLabel>
          <CInputGroup className="mb-3">
            <CFormInput
              type="text"
              value={nuovoContoNome}
              onChange={(e) => setNuovoContoNome(e.target.value)}
              placeholder="Nome del nuovo conto..."
              onKeyDown={(e) => e.key === 'Enter' && creaNuovoConto()}
            />
            <CButton color="success" onClick={creaNuovoConto} disabled={loading}>
              {loading && <CSpinner size="sm" className="me-1" />}
              <CIcon icon={cilSave} />
            </CButton>
          </CInputGroup>
          <CButton size="sm" color="secondary" variant="outline" onClick={() => setModalStep('select')}>
            Torna alla selezione
          </CButton>
        </div>
      )
    }

    if (step === 2) {
      return modalStep === 'select' ? (
        <div>
          <div className="mb-3">
            <CBadge color="primary" className="p-2">
              Conto: {conti.find(c => c.id === selectedConto)?.nome}
            </CBadge>
          </div>
          <CFormLabel>Seleziona Branca Esistente</CFormLabel>
          <CInputGroup className="mb-3">
            <CFormSelect
              value={selectedBranca || ''}
              onChange={(e) => {
                const value = e.target.value
                if (value) {
                  setSelectedBranca(parseInt(value))
                  setStep(3)
                } else {
                  setSelectedBranca(null)
                }
              }}
            >
              <option value="">Seleziona una branca...</option>
              {brancheDisponibili.map(branca => (
                <option key={branca.id} value={branca.id}>{branca.nome}</option>
              ))}
            </CFormSelect>
            <CButton 
              color="success" 
              variant="outline"
              onClick={() => setModalStep('create')}
            >
              <CIcon icon={cilPlus} />
            </CButton>
          </CInputGroup>
          <div className="text-center">
            <small className="text-muted">oppure crea una nuova branca</small>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3">
            <CBadge color="primary" className="p-2">
              Conto: {conti.find(c => c.id === selectedConto)?.nome}
            </CBadge>
          </div>
          <CFormLabel>Nuova Branca</CFormLabel>
          <CInputGroup className="mb-3">
            <CFormInput
              type="text"
              value={nuovaBrancaNome}
              onChange={(e) => setNuovaBrancaNome(e.target.value)}
              placeholder="Nome della nuova branca..."
              onKeyDown={(e) => e.key === 'Enter' && creaNuovaBranca()}
            />
            <CButton color="success" onClick={creaNuovaBranca} disabled={loading}>
              {loading && <CSpinner size="sm" className="me-1" />}
              <CIcon icon={cilSave} />
            </CButton>
          </CInputGroup>
          <CButton size="sm" color="secondary" variant="outline" onClick={() => setModalStep('select')}>
            Torna alla selezione
          </CButton>
        </div>
      )
    }

    if (step === 3) {
      return (
        <div>
          <div className="mb-3">
            <CBadge color="primary" className="p-2 me-2">
              Conto: {conti.find(c => c.id === selectedConto)?.nome}
            </CBadge>
            <CBadge color="success" className="p-2">
              Branca: {brancheDisponibili.find(b => b.id === selectedBranca)?.nome}
            </CBadge>
          </div>
          <CFormLabel>Nuovo Sottoconto</CFormLabel>
          <CInputGroup className="mb-3">
            <CFormInput
              type="text"
              value={nuovoSottocontoNome}
              onChange={(e) => setNuovoSottocontoNome(e.target.value)}
              placeholder="Nome del nuovo sottoconto..."
              onKeyDown={(e) => e.key === 'Enter' && creaNuovoSottoconto()}
            />
            <CButton color="info" onClick={creaNuovoSottoconto} disabled={loading}>
              {loading && <CSpinner size="sm" className="me-1" />}
              <CIcon icon={cilSave} />
            </CButton>
          </CInputGroup>
        </div>
      )
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} size="lg">
      <CModalHeader>
        <CModalTitle>⚡ Aggiungi Struttura Veloce</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {renderStepIndicator()}
        
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError('')}>
            {error}
          </CAlert>
        )}

        {renderStepContent()}

        {step > 1 && (
          <div className="mt-3">
            <CButton 
              size="sm" 
              color="secondary" 
              variant="outline" 
              onClick={() => {
                setStep(step - 1)
                setModalStep('select')
                if (step === 2) setSelectedBranca(null)
              }}
            >
              ← Passo Precedente
            </CButton>
          </div>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={handleClose}>
          <CIcon icon={cilX} className="me-1" />
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default QuickAddModal