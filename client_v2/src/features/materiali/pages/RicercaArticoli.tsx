import React, { useState, useRef, useEffect } from 'react';
import {
  CForm,
  CFormInput,
  CButton,
  CSpinner,
  CAlert,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CInputGroup,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react';
import PageLayout from '@/components/layout/PageLayout';
import ContiSelect from '@/components/selects/ContiSelect';
import BrancheSelect from '@/components/selects/BrancheSelect';
import SottocontiSelect from '@/components/selects/SottocontiSelect';
import { materialiClassificationService } from '../services/materiali-classification.service';
import { useContiStore } from '@/store/conti.store';

// Types per la ricerca articoli
export interface ArticoloRicerca {
  codice_articolo: string;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
}

export interface FatturaRicerca {
  id: string;
  numero_documento: string;
  codice_fornitore: string;
  nome_fornitore?: string;
  descrizione: string;
  data_spesa: string | null;
  costo_totale: number;
}

export interface ClassificazioneEsistente {
  contoid: number;
  brancaid: number | null;
  sottocontoid: number | null;
  contonome: string;
  brancanome: string | null;
  sottocontonome: string | null;
}

export interface RisultatoRicercaArticolo {
  articolo: ArticoloRicerca;
  fattura: FatturaRicerca | null;
  classificazioneEsistente?: ClassificazioneEsistente;
  materiale_id?: number; // ID del materiale nella tabella materiali
}

interface RicercaArticoliProps {
  autoFocus?: boolean;
}

const RicercaArticoli: React.FC<RicercaArticoliProps> = ({ autoFocus = false }) => {
  const [query, setQuery] = useState('');
  const [risultati, setRisultati] = useState<RisultatoRicercaArticolo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cercatoQuery, setCercatoQuery] = useState('');
  // Stati per le 3 select in cascata
  const [classificazioni, setClassificazioni] = useState<
    Record<string, {
      contoid: number | null;
      brancaid: number | null;
      sottocontoid: number | null;
      contonome: string | undefined;
      brancanome: string | undefined;
      sottocontonome: string | undefined;
    }>
  >({});
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});
  const [cancellando, setCancellando] = useState<Record<string, boolean>>({});
  const [modificando, setModificando] = useState<Record<string, boolean>>({});
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [materialeToDelete, setMaterialeToDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Accesso al contistore per i nomi
  const { contiMap, brancheMap, sottocontiMap } = useContiStore();

  // Focus automatico quando il componente viene montato o autoFocus cambia
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  const cercaArticoli = async (searchQuery: string = query) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setError('Inserire almeno 2 caratteri per la ricerca');
      return;
    }

    setLoading(true);
    setError(null);
    setCercatoQuery(searchQuery);

    try {
      // RICERCA UNIFICATA: Cerca prima in materiali, poi in DBF
      console.log('🔍 Ricerca unificata: Materiali + DBF');
      const response = await materialiClassificationService.ricercaArticoli({
        query: searchQuery.trim(),
        limit: 100,
      });

      if (response.success && response.data) {
        console.log(`✅ Trovati ${response.data.articoli.length} articoli`);
        
        // Trasforma i dati dal formato API al formato del componente
        const risultatiFinali = response.data.articoli.map((articolo: any) => ({
          articolo: {
            codice_articolo: articolo.codice_articolo,
            descrizione: articolo.descrizione,
            quantita: articolo.quantita,
            prezzo_unitario: articolo.prezzo_unitario,
          },
          fattura: {
            id: articolo.fattura.id,
            numero_documento: articolo.fattura.numero_documento,
            codice_fornitore: articolo.fattura.codice_fornitore,
            nome_fornitore: articolo.fattura.nome_fornitore || '',
            descrizione: articolo.fattura.numero_documento,
            data_spesa: articolo.fattura.data_spesa,
            costo_totale: articolo.fattura.costo_totale,
          },
          // Classificazione già presente se esiste
          classificazioneEsistente: articolo.classificazioneEsistente,
          materiale_id: articolo.materiale_id
        }));

        // Carica le classificazioni (già presenti se esistenti)
        await caricaClassificazioniEsistenti(risultatiFinali);

        // Ordina i risultati per data fattura decrescente
        const risultatiOrdinati = risultatiFinali.sort((a, b) => {
          const dataA = a.fattura?.data_spesa ? new Date(a.fattura.data_spesa).getTime() : 0;
          const dataB = b.fattura?.data_spesa ? new Date(b.fattura.data_spesa).getTime() : 0;
          return dataB - dataA; // Decrescente
        });
        
        setRisultati(risultatiOrdinati);
      } else {
        setError(response.error || 'Errore nella ricerca articoli');
      }
      
    } catch (err: any) {
      console.error('Errore ricerca articoli:', err);
      setError(err.message || 'Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cercaArticoli();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(num);
  };

  const handleContoChange = (articoloKey: string, contoid: number | null) => {
    console.log(`🔄 Conto cambiato per ${articoloKey}:`, contoid);
    setClassificazioni(prev => ({
      ...prev,
      [articoloKey]: {
        contoid,
        brancaid: null,
        sottocontoid: null,
        contonome: contoid ? contiMap[contoid] : undefined,
        brancanome: undefined,
        sottocontonome: undefined,
      },
    }));
    
    // Pulisci errori quando si cambia conto
    setErrori(prev => {
      const newErrors = { ...prev };
      delete newErrors[articoloKey];
      return newErrors;
    });
  };

  const handleBrancaChange = (articoloKey: string, brancaid: number | null) => {
    setClassificazioni(prev => ({
      ...prev,
      [articoloKey]: {
        ...prev[articoloKey],
        brancaid,
        sottocontoid: null,
        brancanome: brancaid ? brancheMap[brancaid] : undefined,
        sottocontonome: undefined,
      },
    }));
  };

  const handleSottocontoChange = (articoloKey: string, sottocontoid: number | null) => {
    setClassificazioni(prev => ({
      ...prev,
      [articoloKey]: {
        ...prev[articoloKey],
        sottocontoid,
        sottocontonome: sottocontoid ? sottocontiMap[sottocontoid] : undefined,
      },
    }));
  };

  const handleSalvaClassificazione = async (articoloKey: string) => {
    setSalvando(prev => ({ ...prev, [articoloKey]: true }));
    setErrori(prev => {
      const newErrors = { ...prev };
      delete newErrors[articoloKey];
      return newErrors;
    });

    try {
      // Trova il risultato corrispondente all'articoloKey
      const risultato = risultati.find(r => getArticoloKey(r) === articoloKey);
      if (!risultato || !risultato.fattura) {
        throw new Error('Articolo o fattura non trovati');
      }

      const classificazione = classificazioni[articoloKey];
      if (!classificazione || !classificazione.contoid) {
        throw new Error('Seleziona almeno un conto per salvare la classificazione');
      }

      // Costruisci il payload per il server
      const payload: any = {
        codice_articolo: risultato.articolo.codice_articolo || '',
        descrizione: risultato.articolo.descrizione,
        fornitore_id: risultato.fattura.codice_fornitore,
        nome_fornitore: risultato.fattura.nome_fornitore || '',
        contoid: classificazione.contoid,
        contonome: classificazione.contonome || contiMap[classificazione.contoid] || '',
        fattura_id: risultato.fattura.id,
        costo_unitario: risultato.articolo.prezzo_unitario,
      };

      // Aggiungi branca se presente
      if (classificazione.brancaid) {
        payload.brancaid = classificazione.brancaid;
        payload.brancanome = classificazione.brancanome || brancheMap[classificazione.brancaid] || '';
      }

      // Aggiungi sottoconto se presente
      if (classificazione.sottocontoid) {
        payload.sottocontoid = classificazione.sottocontoid;
        payload.sottocontonome = classificazione.sottocontonome || sottocontiMap[classificazione.sottocontoid] || '';
      }

      // Aggiungi data fattura se presente
      if (risultato.fattura.data_spesa) {
        payload.data_fattura = risultato.fattura.data_spesa;
      }

      console.log(`📤 Invio payload per ${articoloKey}:`, payload);

      const response = await materialiClassificationService.salvaClassificazioneMateriale(payload);

      if (response.success) {
        console.log(`✅ Classificazione salvata per ${risultato.articolo.codice_articolo}:`, response.data);
        
        // Aggiorna il risultato con il materiale_id restituito dal backend
        setRisultati(prev => prev.map(r => {
          if (getArticoloKey(r) === articoloKey) {
            return {
              ...r,
              materiale_id: response.data?.id || response.data?.materiale_id
            };
          }
          return r;
        }));
        
        // Esci dalla modalità modifica
        setModificando(prev => ({ ...prev, [articoloKey]: false }));
      } else {
        throw new Error(response.error || 'Errore nel salvataggio');
      }
    } catch (error) {
      console.error('Errore nel salvataggio classificazione:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      setErrori(prev => ({
        ...prev,
        [articoloKey]: errorMessage,
      }));
    } finally {
      setSalvando(prev => ({ ...prev, [articoloKey]: false }));
    }
  };

  const handleCancellaMateriale = (articoloKey: string) => {
    setMaterialeToDelete(articoloKey);
    setShowDeleteModal(true);
  };

  const confirmDeleteMateriale = async () => {
    if (!materialeToDelete) return;

    const articoloKey = materialeToDelete;
    console.log(`🗑️ Tentativo cancellazione per ${articoloKey}`);
    setCancellando(prev => ({ ...prev, [articoloKey]: true }));
    setErrori(prev => {
      const newErrors = { ...prev };
      delete newErrors[articoloKey];
      return newErrors;
    });

    try {
      const risultato = risultati.find(r => getArticoloKey(r) === articoloKey);
      console.log(`🔍 Risultato trovato:`, risultato);
      
      if (!risultato) {
        throw new Error('Risultato non trovato');
      }
      
      if (!risultato.materiale_id) {
        console.error(`❌ ID materiale mancante per ${articoloKey}:`, risultato);
        throw new Error('ID materiale non trovato - il materiale potrebbe non essere ancora classificato');
      }

      console.log(`📤 Invio richiesta cancellazione per materiale_id: ${risultato.materiale_id}`);
      const response = await materialiClassificationService.cancellaMateriale(risultato.materiale_id);
      console.log(`📥 Risposta cancellazione:`, response);

      if (response.success) {
        console.log(`✅ Materiale cancellato: ${risultato.articolo.codice_articolo}`);
        // Rimuovi il materiale dalla lista
        setRisultati(prev => prev.filter(r => getArticoloKey(r) !== articoloKey));
        // Rimuovi la classificazione
        setClassificazioni(prev => {
          const newClassificazioni = { ...prev };
          delete newClassificazioni[articoloKey];
          return newClassificazioni;
        });
        // Chiudi la modal
        setShowDeleteModal(false);
        setMaterialeToDelete(null);
      } else {
        throw new Error(response.error || 'Errore nella cancellazione');
      }
    } catch (error) {
      console.error('❌ Errore nella cancellazione materiale:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      setErrori(prev => ({
        ...prev,
        [articoloKey]: errorMessage,
      }));
    } finally {
      console.log(`🏁 Fine cancellazione per ${articoloKey}`);
      setCancellando(prev => ({ ...prev, [articoloKey]: false }));
    }
  };

  const cancelDeleteMateriale = () => {
    setShowDeleteModal(false);
    setMaterialeToDelete(null);
  };

  const handleIniziaModifica = (articoloKey: string) => {
    setModificando(prev => ({ ...prev, [articoloKey]: true }));
  };

  const handleAnnullaModifica = (articoloKey: string) => {
    setModificando(prev => ({ ...prev, [articoloKey]: false }));
    // Ripristina la classificazione originale
    const risultato = risultati.find(r => getArticoloKey(r) === articoloKey);
    if (risultato?.classificazioneEsistente) {
      setClassificazioni(prev => ({
        ...prev,
        [articoloKey]: {
          contoid: risultato.classificazioneEsistente!.contoid,
          brancaid: risultato.classificazioneEsistente!.brancaid,
          sottocontoid: risultato.classificazioneEsistente!.sottocontoid,
          contonome: risultato.classificazioneEsistente!.contonome,
          brancanome: risultato.classificazioneEsistente!.brancanome || undefined,
          sottocontonome: risultato.classificazioneEsistente!.sottocontonome || undefined,
        },
      }));
    }
  };

  const getArticoloKey = (risultato: RisultatoRicercaArticolo): string => {
    return `${risultato.articolo.codice_articolo}-${risultato.fattura?.id || 'no-fattura'}`;
  };

  const caricaClassificazioniEsistenti = async (risultati: RisultatoRicercaArticolo[]) => {
    console.log('🔍 Caricamento classificazioni esistenti per', risultati.length, 'risultati');
    
    const nuoveClassificazioni: Record<string, {
      contoid: number | null;
      brancaid: number | null;
      sottocontoid: number | null;
      contonome: string | undefined;
      brancanome: string | undefined;
      sottocontonome: string | undefined;
    }> = {};

    // Per ogni risultato, controlla se ha già la classificazione o se devo caricarla
    for (const risultato of risultati) {
      const articoloKey = getArticoloKey(risultato);
      
      // Se il risultato ha già la classificazione esistente, usala direttamente
      if (risultato.classificazioneEsistente) {
        console.log(`✅ Classificazione già presente per ${articoloKey}:`, risultato.classificazioneEsistente);
        
        nuoveClassificazioni[articoloKey] = {
          contoid: risultato.classificazioneEsistente.contoid,
          brancaid: risultato.classificazioneEsistente.brancaid,
          sottocontoid: risultato.classificazioneEsistente.sottocontoid,
          contonome: risultato.classificazioneEsistente.contonome,
          brancanome: risultato.classificazioneEsistente.brancanome || undefined,
          sottocontonome: risultato.classificazioneEsistente.sottocontonome || undefined,
        };
      } else {
        // Altrimenti, carica la classificazione dall'API (solo se abbiamo i parametri necessari)
        if (risultato.articolo.codice_articolo && risultato.fattura?.id) {
          try {
            const response = await materialiClassificationService.getClassificazioneMateriale(
              risultato.articolo.codice_articolo,
              risultato.fattura.id
            );

          if (response.success && response.data) {
            const materiale = response.data;
            console.log(`✅ Classificazione esistente trovata per ${articoloKey}:`, materiale);
            
            nuoveClassificazioni[articoloKey] = {
              contoid: materiale.contoid || null,
              brancaid: materiale.brancaid || null,
              sottocontoid: materiale.sottocontoid || null,
              contonome: materiale.contonome,
              brancanome: materiale.brancanome,
              sottocontonome: materiale.sottocontonome,
            };
          } else {
            console.log(`ℹ️ Nessuna classificazione esistente per ${articoloKey}`);
          }
        } catch (error) {
          console.log(`⚠️ Errore nel caricamento classificazione per ${articoloKey}:`, error);
        }
        } else {
          console.log(`⚠️ Parametri mancanti per ${articoloKey}: codice_articolo=${risultato.articolo.codice_articolo}, fattura_id=${risultato.fattura?.id}`);
        }
      }
    }
    
    // Aggiorna lo stato con tutte le classificazioni trovate
    setClassificazioni(prev => ({
      ...prev,
      ...nuoveClassificazioni,
    }));
    
    console.log('📊 Classificazioni caricate:', Object.keys(nuoveClassificazioni).length);
  };

  return (
    <PageLayout>
      <PageLayout.Header
        title='Ricerca prodotti'
        headerAction={
          <div className='d-flex gap-2'>
            {/* <CButton color='primary' onClick={handleForceRefresh} disabled={isLoading}>
              {isLoading ? 'Caricamento...' : 'Aggiorna'}
            </CButton> */}
          </div>
        }
      />
      <PageLayout.ContentHeader>
        <div className='row'>
          <div className='col-md-5'>
            <h5 className='mb-3'>Ricerca</h5>
            <div className='row g-3'>
              <label className='form-label fw-bold'>
                Inserisci il nome del prodotto da ricercare
              </label>
              <CForm onSubmit={handleSubmit} className='mb-4'>
                <CInputGroup>
                  <CFormInput
                    ref={inputRef}
                    type='text'
                    placeholder='Cerca articolo per descrizione...'
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    disabled={loading}
                  />
                  <CButton type='submit' color='primary' disabled={loading || query.length < 2}>
                    {loading ? (
                      <>
                        <CSpinner size='sm' className='me-2' />
                        Ricerca...
                      </>
                    ) : (
                      'Cerca'
                    )}
                  </CButton>
                </CInputGroup>
              </CForm>

              {error && (
                <CAlert color='danger' dismissible onClose={() => setError(null)}>
                  {error}
                </CAlert>
              )}
            </div>
          </div>
          <div className='col-md-5'>
            <h5 className='mb-3'>Filtri</h5>
            <div className='row g-3'>
              <label className='form-label fw-bold'>Altri filtri</label>
            </div>
          </div>
          <div className='col-md-2'>
            <h5 className='mb-3'>Prodotto selezionato</h5>
            <div className='row g-3'>
              {cercatoQuery && (
                <div className='mb-3'>
                  <CBadge color='info'>
                    Risultati per: "{cercatoQuery}" ({risultati.length} trovati)
                  </CBadge>
                </div>
              )}
            </div>
          </div>
        </div>
      </PageLayout.ContentHeader>
      <PageLayout.ContentBody>
        {risultati.length > 0 && (
          <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Descrizione Articolo</CTableHeaderCell>
                  <CTableHeaderCell>Cod. Art.</CTableHeaderCell>
                  <CTableHeaderCell>Fornitore</CTableHeaderCell>
                  <CTableHeaderCell>Numero Fattura</CTableHeaderCell>
                  <CTableHeaderCell>Data</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Prezzo</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Qtà</CTableHeaderCell>
                  <CTableHeaderCell>Classificazione</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {risultati.map((risultato, index) => {
                  const articoloKey = getArticoloKey(risultato);
                  const classificazione = classificazioni[articoloKey];
                  const isSalvando = salvando[articoloKey];
                  const isCancellando = cancellando[articoloKey];

                  return (
                    <CTableRow key={index}>
                      <CTableDataCell>
                        <div className='fw-semibold'>{risultato.articolo.descrizione}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <small className='text-muted'>{risultato.articolo.codice_articolo}</small>
                      </CTableDataCell>
                      <CTableDataCell>
                        {risultato.fattura ? (
                          <div className='fw-semibold'>
                            {risultato.fattura.nome_fornitore || 'Nome non trovato'}
                          </div>
                        ) : (
                          '-'
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        {risultato.fattura ? (
                          <div>
                            <div className='fw-semibold'>{risultato.fattura.numero_documento}</div>
                            <small className='text-muted'>ID: {risultato.fattura.id}</small>
                          </div>
                        ) : (
                          <span className='text-muted'>Non trovata</span>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        {risultato.fattura ? formatDate(risultato.fattura.data_spesa) : '-'}
                      </CTableDataCell>
                      <CTableDataCell className='text-end'>
                        {formatCurrency(risultato.articolo.prezzo_unitario)}
                      </CTableDataCell>
                      <CTableDataCell className='text-end'>
                        {formatNumber(risultato.articolo.quantita)}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div style={{ minWidth: '400px', position: 'relative' }}>
                          {isSalvando || isCancellando ? (
                            <div className='text-center'>
                              <CSpinner size='sm' className='me-2' />
                              <small>{isSalvando ? 'Salvataggio...' : 'Cancellazione...'}</small>
                            </div>
                          ) : (
                            <div className='d-flex flex-column gap-2'>
                              {classificazione?.contoid && risultato.materiale_id ? (
                                // Materiale già salvato in database
                                <>
                                  {modificando[articoloKey] ? (
                                    // Modalità modifica
                                    <>
                                      {/* Conto */}
                                      <div className='d-flex gap-2 align-items-center'>
                                        <div style={{ flex: 1 }}>
                                          <ContiSelect 
                                            value={classificazione?.contoid || null}
                                            onChange={(contoid) => handleContoChange(articoloKey, contoid)}
                                            autoSelectIfSingle
                                          />
                                        </div>
                                        <CButton
                                          color='success'
                                          size='sm'
                                          onClick={() => handleSalvaClassificazione(articoloKey)}
                                          disabled={!classificazione.contoid}
                                        >
                                          Salva
                                        </CButton>
                                        <CButton
                                          color='secondary'
                                          size='sm'
                                          onClick={() => handleAnnullaModifica(articoloKey)}
                                        >
                                          Annulla
                                        </CButton>
                                      </div>
                                      
                                      {/* Branca - appare solo dopo selezione conto */}
                                      {classificazione?.contoid && (
                                        <div>
                                          <BrancheSelect
                                            contoId={classificazione.contoid}
                                            value={classificazione.brancaid || null}
                                            onChange={(brancaid) => handleBrancaChange(articoloKey, brancaid)}
                                            autoSelectIfSingle
                                          />
                                        </div>
                                      )}
                                      
                                      {/* Sottoconto - appare solo dopo selezione branca */}
                                      {classificazione?.brancaid && (
                                        <div>
                                          <SottocontiSelect
                                            brancaId={classificazione.brancaid}
                                            value={classificazione.sottocontoid || null}
                                            onChange={(sottocontoid) => handleSottocontoChange(articoloKey, sottocontoid)}
                                            autoSelectIfSingle
                                          />
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    // Vista normale - mostra classificazione e pulsanti
                                    <div
                                      className='d-flex align-items-center justify-content-between'
                                      style={{ width: '100%' }}
                                    >
                                      {/* Badge container - float left */}
                                      <div className='d-flex align-items-center gap-2'>
                                        {/* Badge conto */}
                                        <CBadge color='primary' className='text-nowrap' style={{
                                          padding: '0.575rem 0.75rem',
                                          fontSize: '0.875rem',
                                          fontWeight: '400',
                                          borderRadius: '0.25rem',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          minWidth: '80px',
                                        }}>
                                          {classificazione.contonome || contiMap[classificazione.contoid]}
                                        </CBadge>

                                        {/* Badge branca con freccia condizionale */}
                                        {classificazione.brancaid && (
                                          <>
                                            <span style={{ color: '#666', fontSize: '14px' }}>→</span>
                                            <CBadge color='info' className='text-nowrap' style={{
                                              padding: '0.575rem 0.75rem',
                                              fontSize: '0.875rem',
                                              fontWeight: '400',
                                              borderRadius: '0.25rem',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              minWidth: '80px',
                                            }}>
                                              {classificazione.brancanome || brancheMap[classificazione.brancaid]}
                                            </CBadge>
                                          </>
                                        )}

                                        {/* Badge sottoconto con freccia condizionale */}
                                        {classificazione.sottocontoid && (
                                          <>
                                            <span style={{ color: '#666', fontSize: '14px' }}>→</span>
                                            <CBadge color='success' className='text-nowrap' style={{
                                              padding: '0.575rem 0.75rem',
                                              fontSize: '0.875rem',
                                              fontWeight: '400',
                                              borderRadius: '0.25rem',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              minWidth: '80px',
                                            }}>
                                              {classificazione.sottocontonome || sottocontiMap[classificazione.sottocontoid]}
                                            </CBadge>
                                          </>
                                        )}
                                      </div>

                                      {/* Action buttons - float right */}
                                      <div className='d-flex align-items-center gap-1'>
                                        <CButton
                                          color='secondary'
                                          size='sm'
                                          variant='outline'
                                          onClick={() => handleIniziaModifica(articoloKey)}
                                          title='Modifica classificazione'
                                        >
                                          <i className='cil-pencil'></i>
                                        </CButton>
                                        {risultato.materiale_id && (
                                          <CButton
                                            color='danger'
                                            size='sm'
                                            variant='outline'
                                            onClick={() => handleCancellaMateriale(articoloKey)}
                                            title='Cancella materiale'
                                          >
                                            <i className='cil-trash'></i>
                                          </CButton>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                // Materiale non classificato - mostra select per classificare
                                <>
                                  {/* Conto */}
                                  <div className='d-flex gap-2 align-items-center'>
                                    <div style={{ flex: 1 }}>
                                      <ContiSelect 
                                        value={classificazione?.contoid || null}
                                        onChange={(contoid) => handleContoChange(articoloKey, contoid)}
                                        autoSelectIfSingle
                                      />
                                    </div>
                                    {classificazione?.contoid && (
                                      <CButton
                                        color='primary'
                                        size='sm'
                                        onClick={() => handleSalvaClassificazione(articoloKey)}
                                        disabled={!classificazione.contoid}
                                      >
                                        Salva
                                      </CButton>
                                    )}
                                  </div>
                                  
                                  {/* Branca - appare solo dopo selezione conto */}
                                  {classificazione?.contoid && (
                                    <div>
                                      <BrancheSelect
                                        contoId={classificazione.contoid}
                                        value={classificazione.brancaid || null}
                                        onChange={(brancaid) => handleBrancaChange(articoloKey, brancaid)}
                                        autoSelectIfSingle
                                      />
                                    </div>
                                  )}
                                  
                                  {/* Sottoconto - appare solo dopo selezione branca */}
                                  {classificazione?.brancaid && (
                                    <div>
                                      <SottocontiSelect
                                        brancaId={classificazione.brancaid}
                                        value={classificazione.sottocontoid || null}
                                        onChange={(sottocontoid) => handleSottocontoChange(articoloKey, sottocontoid)}
                                        autoSelectIfSingle
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {/* Messaggio di errore */}
                              {errori[articoloKey] && (
                                <CAlert color='danger' className='mt-2 mb-0'>
                                  <small>{errori[articoloKey]}</small>
                                </CAlert>
                              )}
                            </div>
                          )}
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  );
                })}
              </CTableBody>
            </CTable>
          </div>
        )}

        {cercatoQuery && risultati.length === 0 && !loading && !error && (
          <div className='text-center text-muted p-4'>
            <div className='mb-2'>🔍</div>
            <div>Nessun articolo trovato per "{cercatoQuery}"</div>
            <small>Prova con termini diversi o meno specifici</small>
          </div>
        )}
      </PageLayout.ContentBody>
      <PageLayout.Footer text='Ricerca prodotti' />

      {/* Modal di conferma cancellazione */}
      <CModal visible={showDeleteModal} onClose={cancelDeleteMateriale}>
        <CModalHeader>
          <CModalTitle>Conferma Cancellazione</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>Sei sicuro di voler cancellare definitivamente questo materiale dalla tabella materiali?</p>
          <p className="text-muted small">
            Questa azione non può essere annullata.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={cancelDeleteMateriale}>
            Annulla
          </CButton>
          <CButton 
            color="danger" 
            onClick={confirmDeleteMateriale}
            disabled={materialeToDelete ? cancellando[materialeToDelete] : false}
          >
            {materialeToDelete && cancellando[materialeToDelete] ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Cancellazione...
              </>
            ) : (
              'Conferma Cancellazione'
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </PageLayout>
  );
};

export default RicercaArticoli;
