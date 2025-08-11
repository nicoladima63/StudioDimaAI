import React, { useState, useEffect } from 'react'
import {
  CButton,
  CSpinner,
  CButtonGroup,
  CBadge,
  CTooltip
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCenterFocus, cilPencil, cilX, cilCheck, cilWarning, cilCheckCircle } from '@coreui/icons'
import type { MaterialeClassificazione } from '../services/materialiClassificazioni.service'
import { saveClassificazioneMateriale } from '@/api/services/materiali.service'
import SelectConto from '@/components/selects/SelectConto'
import { SelectBranca } from '@/components/selects/SelectBranca'
import { SelectSottoconto } from '@/components/selects/SelectSottoconto'
import { useAutoLearning } from '../utils/autoLearning'
import { CategoriaSpesa } from '../utils/autoCategorization'

interface SelectSmartProps {
  materiale: MaterialeClassificazione
  onClassificazioneAggiornata: (materiale: MaterialeClassificazione) => void
  onError?: (error: string) => void
}

type StatoSelect = 'neutro' | 'select_conto' | 'select_branca' | 'select_sottoconto' | 'completato' | 'loading'

const SelectSmart: React.FC<SelectSmartProps> = ({
  materiale,
  onClassificazioneAggiornata,
  onError
}) => {
  const [stato, setStato] = useState<StatoSelect>('neutro')
  const [contoSelezionato, setContoSelezionato] = useState<number | null>(null)
  const [brancaSelezionata, setBrancaSelezionata] = useState<number | null>(null)
  const [sottocontoSelezionato, setSottocontoSelezionato] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Hook per auto-learning
  const { onMaterialeConfermato } = useAutoLearning()

  // Inizializza stato in base al materiale
  useEffect(() => {
    if (materiale.contoid && materiale.brancaid && materiale.sottocontoid) {
      setStato('completato')
      setContoSelezionato(materiale.contoid)
      setBrancaSelezionata(materiale.brancaid)
      setSottocontoSelezionato(materiale.sottocontoid)
    } else {
      setStato('neutro')
    }
  }, [materiale])
  
  // Helper per determinare la categoria dalla classificazione
  const getCategoriaFromClassificazione = (contoid: number): CategoriaSpesa | null => {
    // Mappatura ID conto -> codice conto -> categoria
    // Questa è una semplificazione, in un caso reale dovresti fare una query
    // Per ora usiamo una mappatura diretta base
    const commonMappings: Record<number, CategoriaSpesa> = {
      1: CategoriaSpesa.MATERIALI_DENTALI, // Esempio
      2: CategoriaSpesa.ENERGIA_ELETTRICA,
      3: CategoriaSpesa.TELECOMUNICAZIONI,
      // Aggiungi altri mapping secondo la tua struttura
    }
    
    return commonMappings[contoid] || CategoriaSpesa.ALTRO
  }

  // Funzioni di caricamento rimosse - ora gestite dai componenti Select

  // Salva classificazione finale (persistenza su tabella materiali)
  const salvaClassificazione = async () => {
    if (!contoSelezionato || !brancaSelezionata || !sottocontoSelezionato) return

    try {
      setLoading(true)
      
      const classificazione = {
        codicearticolo: materiale.codicearticolo,
        nome: materiale.nome,
        fornitoreid: materiale.fornitoreid,
        fornitorenome: materiale.fornitorenome,
        contoid: contoSelezionato,
        brancaid: brancaSelezionata,
        sottocontoid: sottocontoSelezionato,
        categoria_contabile: 'Classificazione manuale'
      }
      
      // Persisti sul nuovo endpoint materiali
      const response = await saveClassificazioneMateriale({
        ...classificazione,
        metodo_classificazione: 'manuale',
        confidence: 100
      })
      
      if (response.success) {
        // Aggiorna materiale con nuova classificazione
        const materialeAggiornato = {
          ...materiale,
          contoid: contoSelezionato,
          brancaid: brancaSelezionata,
          sottocontoid: sottocontoSelezionato,
          categoria_contabile: classificazione.categoria_contabile,
          metodo_classificazione: 'manuale' as const,
          confidence: 100,
          confermato_da_utente: true,
          stato_classificazione: 'classificato' as const
        }
        
        // Auto-learning: aggiorna pattern fornitore
        const categoria = getCategoriaFromClassificazione(contoSelezionato)
        if (categoria && materiale.fornitoreid) {
          onMaterialeConfermato(
            { 
              fornitoreid: materiale.fornitoreid,
              categoria_contabile: classificazione.categoria_contabile 
            },
            categoria
          ).catch(error => console.warn('Auto-learning fallito:', error))
        }
        
        onClassificazioneAggiornata(materialeAggiornato)
        setStato('completato')
      }
    } catch (error) {
      onError?.('Errore salvataggio classificazione')
    } finally {
      setLoading(false)
    }
  }

  // Conferma classificazione automatica (persistenza su tabella materiali)
  const confermaClassificazioneAutomatica = async () => {
    if (!materiale.contoid || !materiale.brancaid || !materiale.sottocontoid) return

    try {
      setLoading(true)
      
      const classificazione = {
        codicearticolo: materiale.codicearticolo,
        nome: materiale.nome,
        fornitoreid: materiale.fornitoreid,
        fornitorenome: materiale.fornitorenome,
        contoid: materiale.contoid!,
        contonome: materiale.contonome,
        brancaid: materiale.brancaid!,
        brancanome: materiale.brancanome || undefined,
        sottocontoid: materiale.sottocontoid!,
        sottocontonome: materiale.sottocontonome || undefined,
        categoria_contabile: materiale.categoria_contabile || `${materiale.contonome} - ${materiale.brancanome} - ${materiale.sottocontonome}`
      }
      // Persisti sul nuovo endpoint materiali
      const response = await saveClassificazioneMateriale({
        ...classificazione,
        metodo_classificazione: 'confermato',
        confidence: 100
      })
      
      if (response.success) {
        // Aggiorna materiale confermato
        const materialeAggiornato = {
          ...materiale,
          metodo_classificazione: 'confermato' as const,
          confidence: 100,
          confermato_da_utente: true,
          stato_classificazione: 'classificato' as const
        }
        
        // Auto-learning: aggiorna pattern fornitore dalla classificazione confermata
        const categoria = getCategoriaFromClassificazione(materiale.contoid!)
        if (categoria && materiale.fornitoreid) {
          onMaterialeConfermato(
            { 
              fornitoreid: materiale.fornitoreid,
              categoria_contabile: classificazione.categoria_contabile 
            },
            categoria
          ).catch(error => console.warn('Auto-learning fallito:', error))
        }
        
        onClassificazioneAggiornata(materialeAggiornato)
        setStato('completato')
      }
    } catch (error) {
      onError?.('Errore conferma classificazione')
    } finally {
      setLoading(false)
    }
  }

  // Handlers per cambio stato
  const handleIniziaClassificazione = () => {
    setStato('select_conto')
  }

  const handleSelezionaConto = (contoId: number | null) => {
    setContoSelezionato(contoId)
    setBrancaSelezionata(null)
    setSottocontoSelezionato(null)
    if (contoId) {
      setStato('select_branca')
    }
  }

  const handleSelezionaBranca = (brancaId: number | null) => {
    setBrancaSelezionata(brancaId)
    setSottocontoSelezionato(null)
    if (brancaId) {
      setStato('select_sottoconto')
    }
  }

  const handleSelezionaSottoconto = (sottocontoId: number | null) => {
    setSottocontoSelezionato(sottocontoId)
    if (sottocontoId) {
      salvaClassificazione()
    }
  }

  const handleReset = () => {
    setStato('neutro')
    setContoSelezionato(null)
    setBrancaSelezionata(null)
    setSottocontoSelezionato(null)
  }

  const handleModifica = () => {
    setStato('select_conto')
  }

  // Badge confidence
  const getBadgeConfidence = () => {
    if (materiale.confidence >= 90) {
      return <CBadge color="success">🟢 {materiale.confidence}%</CBadge>
    } else if (materiale.confidence >= 60) {
      return <CBadge color="warning">🟡 {materiale.confidence}%</CBadge>
    } else {
      return <CBadge color="danger">🔴 {materiale.confidence}%</CBadge>
    }
  }

  // Render basato sullo stato
  const renderContent = () => {
    if (loading) {
      return (
        <CButtonGroup>
          <CSpinner size="sm" />
          <span className="ms-2">Caricamento...</span>
        </CButtonGroup>
      )
    }

    switch (stato) {
      case 'neutro':
        // Se è un materiale "da_verificare" mostra tasto conferma
        if (materiale.stato_classificazione === 'da_verificare' && materiale.contoid && materiale.brancaid && materiale.sottocontoid) {
          return (
            <CButtonGroup>
              <CTooltip content="Conferma classificazione automatica">
                <CButton 
                  color="success"
                  variant="outline"
                  size="sm"
                  onClick={confermaClassificazioneAutomatica}
                >
                  <CIcon icon={cilCheckCircle} className="me-1" />
                  Conferma
                </CButton>
              </CTooltip>
              <CTooltip content="Modifica classificazione">
                <CButton 
                  color="warning"
                  variant="outline"
                  size="sm"
                  onClick={handleIniziaClassificazione}
                >
                  <CIcon icon={cilPencil} />
                </CButton>
              </CTooltip>
            </CButtonGroup>
          )
        }
        
        return (
          <CTooltip content="Inizia classificazione materiale">
            <CButton 
              color="primary"
              variant="outline"
              size="sm"
              onClick={handleIniziaClassificazione}
            >
              <CIcon icon={cilCenterFocus} className="me-1" />
              Classifica
            </CButton>
          </CTooltip>
        )

      case 'select_conto':
        return (
          <CButtonGroup>
            <SelectConto 
              value={contoSelezionato} 
              onChange={handleSelezionaConto}
              style={{ minWidth: '200px' }}
            />
            <CTooltip content="Annulla">
              <CButton
                color="danger"
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                <CIcon icon={cilX} />
              </CButton>
            </CTooltip>
          </CButtonGroup>
        )

      case 'select_branca':
        return (
          <CButtonGroup>
            <CBadge color="info" className="me-2">
              Conto selezionato
            </CBadge>
            <SelectBranca 
              contoId={contoSelezionato}
              value={brancaSelezionata} 
              onChange={handleSelezionaBranca}
              style={{ minWidth: '200px' }}
            />
            <CTooltip content="Annulla">
              <CButton
                color="danger"
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                <CIcon icon={cilX} />
              </CButton>
            </CTooltip>
          </CButtonGroup>
        )

      case 'select_sottoconto':
        return (
          <CButtonGroup>
            <CBadge color="info" className="me-2">
              Conto
            </CBadge>
            <CBadge color="secondary" className="me-2">
              Branca
            </CBadge>
            <SelectSottoconto 
              brancaId={brancaSelezionata}
              value={sottocontoSelezionato} 
              onChange={handleSelezionaSottoconto}
              style={{ minWidth: '200px' }}
            />
            <CTooltip content="Annulla">
              <CButton
                color="danger"
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                <CIcon icon={cilX} />
              </CButton>
            </CTooltip>
          </CButtonGroup>
        )

      case 'completato':
        return (
          <CButtonGroup>
            <CBadge 
              color={materiale.metodo_classificazione === 'manuale' ? 'success' : 'warning'}
              className="me-2"
            >
              {materiale.metodo_classificazione === 'manuale' ? '✅' : '🤖'} 
              {materiale.contonome} → {materiale.brancanome} → {materiale.sottocontonome}
            </CBadge>
            
            <CTooltip content="Modifica classificazione">
              <CButton
                color="warning"
                variant="outline"
                size="sm"
                onClick={handleModifica}
              >
                <CIcon icon={cilPencil} />
              </CButton>
            </CTooltip>
            
            <CTooltip content="Reset classificazione">
              <CButton
                color="danger"
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                <CIcon icon={cilX} />
              </CButton>
            </CTooltip>
          </CButtonGroup>
        )

      default:
        return null
    }
  }

  return (
    <div className="d-flex align-items-center gap-2">
      {renderContent()}
      {materiale.stato_classificazione === 'da_verificare' && (
        <CTooltip content="Classificazione automatica da verificare">
          <CBadge color="warning">
            <CIcon icon={cilWarning} size="sm" />
          </CBadge>
        </CTooltip>
      )}
    </div>
  )
}

export default SelectSmart