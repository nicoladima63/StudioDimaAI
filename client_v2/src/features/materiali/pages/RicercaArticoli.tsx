import React, { useState, useRef, useEffect } from "react";
import {
  CCard,
  CCardBody,
  CCardHeader,
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
} from "@coreui/react";
import ClassificazioneGerarchica from "@/features/fornitori/components/ClassificazioneGerarchica";
import type { ClassificazioneCosto } from "@/features/fornitori/types";
import { materialiClassificationService } from "../services/materiali-classification.service";
import { useContiStore } from "@/store/conti.store";

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

export interface RisultatoRicercaArticolo {
  articolo: ArticoloRicerca;
  fattura: FatturaRicerca | null;
}

interface RicercaArticoliProps {
  autoFocus?: boolean;
}

const RicercaArticoli: React.FC<RicercaArticoliProps> = ({
  autoFocus = false,
}) => {
  const [query, setQuery] = useState("");
  const [risultati, setRisultati] = useState<RisultatoRicercaArticolo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cercatoQuery, setCercatoQuery] = useState("");
  const [classificazioni, setClassificazioni] = useState<Record<string, ClassificazioneCosto | null>>({});
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});
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
      setError("Inserire almeno 2 caratteri per la ricerca");
      return;
    }

    setLoading(true);
    setError(null);
    setCercatoQuery(searchQuery);

    try {
      const response = await materialiClassificationService.ricercaArticoli({
        query: searchQuery.trim(),
        limit: 100
      });
      
      if (response.success && response.data) {
        // Trasforma i dati dal formato API al formato del componente
        const risultatiTrasformati = response.data.articoli.map(articolo => ({
          articolo: {
            codice_articolo: articolo.codice_articolo,
            descrizione: articolo.descrizione,
            quantita: articolo.quantita,
            prezzo_unitario: articolo.prezzo_unitario
          },
          fattura: {
            id: articolo.fattura.id,
            numero_documento: articolo.fattura.numero_documento,
            codice_fornitore: articolo.fattura.codice_fornitore,
            nome_fornitore: articolo.fattura.nome_fornitore || '',
            descrizione: articolo.fattura.numero_documento, // Usa numero documento come descrizione
            data_spesa: articolo.fattura.data_spesa,
            costo_totale: articolo.fattura.costo_totale
          }
        }));
        
        // Ordina i risultati per data fattura decrescente
        const risultatiOrdinati = risultatiTrasformati.sort((a, b) => {
          const dataA = a.fattura?.data_spesa ? new Date(a.fattura.data_spesa).getTime() : 0;
          const dataB = b.fattura?.data_spesa ? new Date(b.fattura.data_spesa).getTime() : 0;
          return dataB - dataA; // Decrescente
        });
        setRisultati(risultatiOrdinati);
      } else {
        setError(response.error || "Errore nella ricerca articoli");
      }
    } catch (err: any) {
      console.error("Errore ricerca articoli:", err);
      setError(err.message || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cercaArticoli();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("it-IT");
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(num);
  };

  const handleClassificazioneChange = (articoloKey: string, contoid: number | null, brancaid: number | null, sottocontoid: number | null) => {
    setClassificazioni(prev => ({
      ...prev,
      [articoloKey]: {
        contoid,
        brancaid,
        sottocontoid,
        tipo_di_costo: 1
      } as ClassificazioneCosto
    }));
  };

  const handleSalvaClassificazione = async (articoloKey: string, contoid: number, brancaid: number | null, sottocontoid: number | null) => {
    setSalvando(prev => ({ ...prev, [articoloKey]: true }));
    
    try {
      // Trova il risultato corrispondente all'articoloKey
      const risultato = risultati.find(r => getArticoloKey(r) === articoloKey);
      if (!risultato || !risultato.fattura) {
        throw new Error("Articolo o fattura non trovati");
      }
      
      const payload: any = {
        codice_articolo: risultato.articolo.codice_articolo,
        descrizione: risultato.articolo.descrizione,
        fornitore_id: risultato.fattura.codice_fornitore,
        nome_fornitore: risultato.fattura.nome_fornitore || '',
        contoid,
        contonome: contiMap[contoid] || '',
        fattura_id: risultato.fattura.id,
        costo_unitario: risultato.articolo.prezzo_unitario
      };

      if (brancaid) {
        payload.brancaid = brancaid;
        payload.brancanome = brancheMap[brancaid] || '';
      }
      if (sottocontoid) {
        payload.sottocontoid = sottocontoid;
        payload.sottocontonome = sottocontiMap[sottocontoid] || '';
      }
      if (risultato.fattura.data_spesa) payload.data_fattura = risultato.fattura.data_spesa;

      const response = await materialiClassificationService.salvaClassificazioneMateriale(payload);
      
      if (response.success) {
        // Aggiorna stato locale
        setClassificazioni(prev => ({
          ...prev,
          [articoloKey]: {
            contoid,
            brancaid,
            sottocontoid,
            tipo_di_costo: 1
          } as ClassificazioneCosto
        }));
        
        console.log(`✅ Classificazione salvata per ${risultato.articolo.codice_articolo}`);
      } else {
        throw new Error(response.error || "Errore nel salvataggio");
      }
      
    } catch (error) {
      console.error("Errore nel salvataggio classificazione:", error);
      setError(`Errore nel salvataggio: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setSalvando(prev => ({ ...prev, [articoloKey]: false }));
    }
  };

  const getArticoloKey = (risultato: RisultatoRicercaArticolo): string => {
    return `${risultato.articolo.codice_articolo}-${risultato.fattura?.id || 'no-fattura'}`;
  };

  return (
    <CCard style={{ overflow: "visible" }}>
      <CCardHeader>
        <h5 className="mb-0">🔍 Ricerca Articoli per Classificazione</h5>
        <p className="text-muted mb-0 small">
          Cerca articoli nelle fatture fornitori e classificali per il bulk import
        </p>
      </CCardHeader>
      <CCardBody style={{ overflow: "visible" }}>
        <CForm onSubmit={handleSubmit} className="mb-4">
          <CInputGroup>
            <CFormInput
              ref={inputRef}
              type="text"
              placeholder="Cerca articolo per descrizione..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <CButton
              type="submit"
              color="primary"
              disabled={loading || query.length < 2}
            >
              {loading ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Ricerca...
                </>
              ) : (
                "Cerca"
              )}
            </CButton>
          </CInputGroup>
        </CForm>

        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        {cercatoQuery && (
          <div className="mb-3">
            <CBadge color="info">
              Risultati per: "{cercatoQuery}" ({risultati.length} trovati)
            </CBadge>
          </div>
        )}

        {risultati.length > 0 && (
          <div style={{ overflowX: "auto", overflowY: "visible" }}>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Descrizione Articolo</CTableHeaderCell>
                  <CTableHeaderCell>Cod. Art.</CTableHeaderCell>
                  <CTableHeaderCell>Fornitore</CTableHeaderCell>
                  <CTableHeaderCell>Numero Fattura</CTableHeaderCell>
                  <CTableHeaderCell>Data</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Prezzo</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Qtà</CTableHeaderCell>
                  <CTableHeaderCell>Classificazione</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {risultati.map((risultato, index) => {
                  const articoloKey = getArticoloKey(risultato);
                  const classificazione = classificazioni[articoloKey];
                  const isSalvando = salvando[articoloKey];
                  
                  return (
                    <CTableRow key={index}>
                      <CTableDataCell>
                        <div className="fw-semibold">
                          {risultato.articolo.descrizione}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <small className="text-muted">
                          {risultato.articolo.codice_articolo}
                        </small>
                      </CTableDataCell>
                      <CTableDataCell>
                        {risultato.fattura ? (
                          <div className="fw-semibold">
                            {risultato.fattura.nome_fornitore || 'Nome non trovato'}
                          </div>
                        ) : (
                          "-"
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        {risultato.fattura ? (
                          <div>
                            <div className="fw-semibold">{risultato.fattura.numero_documento}</div>
                            <small className="text-muted">ID: {risultato.fattura.id}</small>
                          </div>
                        ) : (
                          <span className="text-muted">Non trovata</span>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        {risultato.fattura ? (
                          formatDate(risultato.fattura.data_spesa)
                        ) : (
                          "-"
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">
                        {formatCurrency(risultato.articolo.prezzo_unitario)}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">
                        {formatNumber(risultato.articolo.quantita)}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div style={{ minWidth: '300px', position: 'relative' }}>
                          {isSalvando ? (
                            <div className="text-center">
                              <CSpinner size="sm" className="me-2" />
                              <small>Salvataggio...</small>
                            </div>
                          ) : (
                            <ClassificazioneGerarchica
                              classificazione={classificazione}
                              onClassificazioneChange={(contoid, brancaid, sottocontoid) => 
                                handleClassificazioneChange(articoloKey, contoid, brancaid, sottocontoid)
                              }
                              onSave={(contoid, brancaid, sottocontoid) => 
                                handleSalvaClassificazione(articoloKey, contoid, brancaid, sottocontoid)
                              }
                            />
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
          <div className="text-center text-muted p-4">
            <div className="mb-2">🔍</div>
            <div>Nessun articolo trovato per "{cercatoQuery}"</div>
            <small>Prova con termini diversi o meno specifici</small>
          </div>
        )}
      </CCardBody>
    </CCard>
  );
};

export default RicercaArticoli;
