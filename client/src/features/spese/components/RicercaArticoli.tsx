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
  CCollapse,
} from "@coreui/react";
import { speseFornitioriService } from "../services/spese.service";
import TestataFattura from "./TestataFattura";
import type { RisultatoRicercaArticolo, DettaglioSpesaFornitore } from "../types";

interface RicercaArticoliProps {
  onSelezionaFattura?: (fatturaId: string) => void;
  onCaricaMagazzino?: (dettaglio: DettaglioSpesaFornitore) => void;
  autoFocus?: boolean;
}

const RicercaArticoli: React.FC<RicercaArticoliProps> = ({
  onSelezionaFattura,
  onCaricaMagazzino,
  autoFocus = false,
}) => {
  const [query, setQuery] = useState("");
  const [risultati, setRisultati] = useState<RisultatoRicercaArticolo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cercatoQuery, setCercatoQuery] = useState("");
  const [fatturaEspansa, setFatturaEspansa] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const response = await speseFornitioriService.ricercaArticoli(searchQuery.trim(), 100);
      
      if (response.success) {
        setRisultati(response.data);
      } else {
        setError("Errore nella ricerca articoli");
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

  const handleMostraDettagliFattura = (fatturaId: string) => {
    if (fatturaEspansa === fatturaId) {
      setFatturaEspansa(null); // Chiudi se già aperta
    } else {
      setFatturaEspansa(fatturaId); // Apri dettagli
    }
  };

  const handleVaiAllaTabFatture = (fatturaId: string) => {
    if (onSelezionaFattura) {
      onSelezionaFattura(fatturaId);
    }
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

  return (
    <CCard>
      <CCardHeader>
        <h5 className="mb-0">🔍 Ricerca Articoli</h5>
        <p className="text-muted mb-0 small">
          Cerca articoli nelle fatture fornitori e trova la fattura di origine
        </p>
      </CCardHeader>
      <CCardBody>
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
          <div style={{ overflowX: "auto" }}>
            <CTable hover responsive size="sm">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Descrizione Articolo</CTableHeaderCell>
                  <CTableHeaderCell>Cod. Art.</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Qtà</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Prezzo</CTableHeaderCell>
                  <CTableHeaderCell>Fattura di Origine</CTableHeaderCell>
                  <CTableHeaderCell>Fornitore</CTableHeaderCell>
                  <CTableHeaderCell>Data</CTableHeaderCell>
                  <CTableHeaderCell>Stato</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {risultati.map((risultato, index) => (
                  <CTableRow 
                  key={index}
                  style={{ cursor: risultato.fattura ? "pointer" : "default" }}
                  onClick={() => risultato.fattura && handleMostraDettagliFattura(risultato.fattura.id)}
                >
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
                    <CTableDataCell className="text-end">
                      {formatNumber(risultato.articolo.quantita)}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {formatCurrency(risultato.articolo.prezzo_unitario)}
                    </CTableDataCell>
                    <CTableDataCell>
                      {risultato.fattura ? (
                        <div>
                          <div className="fw-semibold">
                            {risultato.fattura.numero_documento}
                          </div>
                          <small className="text-muted">
                            {risultato.fattura.descrizione}
                          </small>
                        </div>
                      ) : (
                        <span className="text-muted">Non trovata</span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {risultato.fattura ? (
                        <div>
                          <CBadge color="primary">
                            {risultato.fattura.codice_fornitore}
                          </CBadge>
                          <br />
                          <small className="text-muted">
                            {risultato.fattura.nome_fornitore || 'Nome non trovato'}
                          </small>
                        </div>
                      ) : (
                        "-"
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {risultato.fattura ? (
                        formatDate(risultato.fattura.data_spesa)
                      ) : (
                        "-"
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {risultato.fattura && fatturaEspansa === risultato.fattura.id && (
                        <small className="text-success">📋 Espansa</small>
                      )}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}

        {/* Testata fattura espansa */}
        {fatturaEspansa && (
          <CCollapse visible={true}>
            <div className="mt-3">
              <TestataFattura
                fatturaId={fatturaEspansa}
                onVaiAllaFattura={handleVaiAllaTabFatture}
              />
            </div>
          </CCollapse>
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