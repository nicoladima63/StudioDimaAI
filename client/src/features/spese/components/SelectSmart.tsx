import React, { useState, useEffect } from 'react'
import {
  CButton,
  CFormSelect,
  CSpinner,
  CButtonGroup,
  CBadge,
  CTooltip
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCenterFocus, cilPencil, cilX, cilCheck, cilWarning, cilCheckCircle } from '@coreui/icons'
import materialiClassificazioniService from '../services/materialiClassificazioni.service'
import type { Conto, Branca, Sottoconto, MaterialeClassificazione } from '../services/materialiClassificazioni.service'
import { saveClassificazioneMateriale } from '@/api/services/materiali.service'

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
  const [contiDisponibili, setContiDisponibili] = useState<Conto[]>([])
  const [brancheDisponibili, setBrancheDisponibili] = useState<Branca[]>([])
  const [sottocontiDisponibili, setSottocontiDisponibili] = useState<Sottoconto[]>([])
  const [contoSelezionato, setContoSelezionato] = useState<string>('')
  const [brancaSelezionata, setBrancaSelezionata] = useState<string>('')
  const [sottocontoSelezionato, setSottocontoSelezionato] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Inizializza stato in base al materiale
  useEffect(() => {
    if (materiale.conto_codice && materiale.branca_codice && materiale.sottoconto_codice) {
      setStato('completato')
      setContoSelezionato(materiale.conto_codice)
      setBrancaSelezionata(materiale.branca_codice)
      setSottocontoSelezionato(materiale.sottoconto_codice)
    } else {
      setStato('neutro')
    }
  }, [materiale])

  // Carica conti disponibili
  const caricaContiDisponibili = async () => {
    try {
      setLoading(true)
      const response = await materialiClassificazioniService.apiGetContiDisponibili()
      if (response.success) {
        setContiDisponibili(response.data)
      }
    } catch (error) {
      onError?.('Errore caricamento conti disponibili')
    } finally {
      setLoading(false)
    }
  }

  // Carica branche per un conto
  const caricaBrancheDisponibili = async (contoId: number) => {
    try {
      setLoading(true)
      const response = await materialiClassificazioniService.apiGetBrancheDisponibili(contoId)
      if (response.success) {
        setBrancheDisponibili(response.data)
      }
    } catch (error) {
      onError?.('Errore caricamento branche disponibili')
    } finally {
      setLoading(false)
    }
  }

  // Carica sottoconti per una branca
  const caricaSottocontiDisponibili = async (brancaId: number) => {
    try {
      setLoading(true)
      const response = await materialiClassificazioniService.apiGetSottocontiDisponibili(brancaId)
      if (response.success) {
        setSottocontiDisponibili(response.data)
      }
    } catch (error) {
      onError?.('Errore caricamento sottoconti disponibili')
    } finally {
      setLoading(false)
    }
  }

  // Salva classificazione finale (persistenza su tabella materiali)
  const salvaClassificazione = async () => {
    if (!contoSelezionato || !brancaSelezionata || !sottocontoSelezionato) return

    try {
      setLoading(true)
      
      const contoObj = contiDisponibili.find(c => c.codice === contoSelezionato)
      const brancaObj = brancheDisponibili.find(b => b.id.toString() === brancaSelezionata)
      const sottocontoObj = sottocontiDisponibili.find(s => s.codice === sottocontoSelezionato)
      
      const classificazione = {
        codice_articolo: materiale.codice_articolo,
        descrizione: materiale.descrizione,
        codice_fornitore: materiale.codice_fornitore,
        nome_fornitore: materiale.nome_fornitore,
        conto_codice: contoSelezionato,
        branca_codice: brancaSelezionata,
        sottoconto_codice: sottocontoSelezionato,
        categoria_contabile: `${contoObj?.descrizione} - ${brancaObj?.nome} - ${sottocontoObj?.descrizione}` || ''
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
          conto_codice: contoSelezionato,
          branca_codice: brancaSelezionata,
          sottoconto_codice: sottocontoSelezionato,
          categoria_contabile: classificazione.categoria_contabile,
          metodo_classificazione: 'manuale' as const,
          confidence: 100,
          confermato_da_utente: true,
          stato_classificazione: 'classificato' as const
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
    if (!materiale.conto_codice || !materiale.branca_codice || !materiale.sottoconto_codice) return

    try {
      setLoading(true)
      
      const classificazione = {
        codice_articolo: materiale.codice_articolo,
        descrizione: materiale.descrizione,
        codice_fornitore: materiale.codice_fornitore,
        nome_fornitore: materiale.nome_fornitore,
        conto_codice: materiale.conto_codice,
        branca_codice: materiale.branca_codice,
        sottoconto_codice: materiale.sottoconto_codice,
        categoria_contabile: materiale.categoria_contabile || `${materiale.conto_codice} - ${materiale.branca_codice} - ${materiale.sottoconto_codice}`
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
  const handleIniziaClassificazione = async () => {
    setStato('select_conto')
    if (contiDisponibili.length === 0) {
      await caricaContiDisponibili()
    }
  }

  const handleSelezionaConto = async (conto: string) => {
    setContoSelezionato(conto)
    setStato('select_branca')
    
    // Trova l'ID del conto per caricare le branche
    const contoObj = contiDisponibili.find(c => c.codice === conto)
    if (contoObj) {
      await caricaBrancheDisponibili(contoObj.id)
    }
  }

  const handleSelezionaBranca = async (brancaId: string) => {
    setBrancaSelezionata(brancaId)
    setStato('select_sottoconto')
    await caricaSottocontiDisponibili(parseInt(brancaId))
  }

  const handleSelezionaSottoconto = (sottoconto: string) => {
    setSottocontoSelezionato(sottoconto)
    salvaClassificazione()
  }

  const handleReset = () => {
    setStato('neutro')
    setContoSelezionato('')
    setBrancaSelezionata('')
    setSottocontoSelezionato('')
    setBrancheDisponibili([])
    setSottocontiDisponibili([])
  }

  const handleModifica = () => {
    setStato('select_conto')
    if (contiDisponibili.length === 0) {
      caricaContiDisponibili()
    }
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
        if (materiale.stato_classificazione === 'da_verificare' && materiale.conto_codice && materiale.branca_codice && materiale.sottoconto_codice) {
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
            <CFormSelect
              size="sm"
              value={contoSelezionato}
              onChange={(e) => handleSelezionaConto(e.target.value)}
              style={{ minWidth: '200px' }}
            >
              <option value="">▼ Seleziona Conto</option>
              {contiDisponibili.map(conto => (
                <option key={conto.codice} value={conto.codice}>
                  {conto.label}
                </option>
              ))}
            </CFormSelect>
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
        const contoObj = contiDisponibili.find(c => c.codice === contoSelezionato)
        return (
          <CButtonGroup>
            <CBadge color="info" className="me-2">
              {contoObj?.descrizione}
            </CBadge>
            <CFormSelect
              size="sm"
              value={brancaSelezionata}
              onChange={(e) => handleSelezionaBranca(e.target.value)}
              style={{ minWidth: '200px' }}
            >
              <option value="">▼ Seleziona Branca</option>
              {brancheDisponibili.map(branca => (
                <option key={branca.id} value={branca.id.toString()}>
                  {branca.nome}
                </option>
              ))}
            </CFormSelect>
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
        const contoObjSotto = contiDisponibili.find(c => c.codice === contoSelezionato)
        const brancaObj = brancheDisponibili.find(b => b.id.toString() === brancaSelezionata)
        return (
          <CButtonGroup>
            <CBadge color="info" className="me-2">
              {contoObjSotto?.descrizione}
            </CBadge>
            <CBadge color="secondary" className="me-2">
              {brancaObj?.nome}
            </CBadge>
            <CFormSelect
              size="sm"
              value={sottocontoSelezionato}
              onChange={(e) => handleSelezionaSottoconto(e.target.value)}
              style={{ minWidth: '200px' }}
            >
              <option value="">▼ Seleziona Sottoconto</option>
              {sottocontiDisponibili.map(sottoconto => (
                <option key={sottoconto.codice} value={sottoconto.codice}>
                  {sottoconto.label}
                </option>
              ))}
            </CFormSelect>
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
        const sottocontoObj = sottocontiDisponibili.find(s => s.codice === sottocontoSelezionato) || 
                              { descrizione: materiale.sottoconto_codice }
        const contoCompletato = contiDisponibili.find(c => c.codice === contoSelezionato) ||
                                { descrizione: materiale.conto_codice }
        const brancaCompletata = brancheDisponibili.find(b => b.id.toString() === brancaSelezionata) ||
                                { nome: materiale.branca_codice }
        
        return (
          <CButtonGroup>
            <CBadge 
              color={materiale.metodo_classificazione === 'manuale' ? 'success' : 'warning'}
              className="me-2"
            >
              {materiale.metodo_classificazione === 'manuale' ? '✅' : '🤖'} 
              {contoCompletato.descrizione} → {brancaCompletata.nome} → {sottocontoObj.descrizione}
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