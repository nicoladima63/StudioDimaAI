import React, { useState, useEffect } from "react";
import {
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CSpinner,
  CAlert,
  CButton,
  CBadge,
} from "@coreui/react";
import { speseFornitioriService } from "../services/spese.service";
import type { DettaglioSpesaFornitore } from "../types";

interface DettagliFatturaProps {
  fatturaId: string;
  onCaricaMagazzino?: (dettaglio: DettaglioSpesaFornitore) => void;
}

const DettagliFattura: React.FC<DettagliFatturaProps> = ({
  fatturaId,
  onCaricaMagazzino,
}) => {
  const [dettagli, setDettagli] = useState<DettaglioSpesaFornitore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const caricaDettagli = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await speseFornitioriService.getDettagliFattura(fatturaId);
      
      if (response.success) {
        setDettagli(response.data);
      } else {
        setError("Errore nel caricamento dei dettagli");
      }
    } catch (err: any) {
      console.error("Errore caricamento dettagli:", err);
      setError(err.message || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fatturaId) {
      caricaDettagli();
    }
  }, [fatturaId]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(num);
  };

  const dettagliFiltrati = dettagli.filter(dettaglio => dettaglio.totale_riga > 0 && dettaglio.quantita > 0);
  
  const calcolaTotaleDettagli = (): number => {
    return dettagliFiltrati.reduce((acc, dettaglio) => acc + dettaglio.totale_riga, 0);
  };

  if (loading) {
    return (
      <div className="text-center p-3">
        <CSpinner color="primary" size="sm" />
        <span className="ms-2">Caricamento dettaglixxx...</span>
      </div>
    );
  }

  if (error) {
    return (
      <CAlert color="danger" className="m-3">
        {error}
      </CAlert>
    );
  }

  if (dettagli.length === 0) {
    return (
      <div className="text-center p-3 text-muted">
        Nessun dettaglio trovato per questa fattura
      </div>
    );
  }

  if (dettagliFiltrati.length === 0) {
    return (
      <div className="text-center p-3 text-muted">
        Nessuna riga utile in questa fattura (tutte le righe hanno importo o quantità zero)
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="bg-light p-3 border-top">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">
            <strong>Dettagli Fattura {fatturaId}</strong>
          </h6>
          <CBadge color="info">
            {dettagliFiltrati.length} righe utili - Totale: {formatCurrency(calcolaTotaleDettagli())}
          </CBadge>
        </div>
        
        <div style={{ overflowX: "auto" }}>
          <CTable hover>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Cod. Art.</CTableHeaderCell>
                <CTableHeaderCell>Descrizione</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Qtà</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Prezzo</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Sconto %</CTableHeaderCell>
                <CTableHeaderCell className="text-end">IVA %</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Totale Riga</CTableHeaderCell>
                {onCaricaMagazzino && (
                  <CTableHeaderCell>Azioni</CTableHeaderCell>
                )}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {dettagliFiltrati.map((dettaglio, index) => (
                <CTableRow key={index}>
                  <CTableDataCell>
                    <small className="text-muted">
                      {dettaglio.codice_articolo}
                    </small>
                  </CTableDataCell>
                  <CTableDataCell>
                    <div className="text-truncate" style={{ maxWidth: "300px" }}>
                      {dettaglio.descrizione}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {formatNumber(dettaglio.quantita)}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {formatCurrency(dettaglio.prezzo_unitario)}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {dettaglio.sconto > 0 ? `${formatNumber(dettaglio.sconto)}%` : "-"}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {formatNumber(dettaglio.aliquota_iva)}%
                  </CTableDataCell>
                  <CTableDataCell className="text-end fw-bold">
                    {formatCurrency(dettaglio.totale_riga)}
                  </CTableDataCell>
                  {onCaricaMagazzino && (
                    <CTableDataCell>
                      <CButton
                        color="success"
                        variant="outline"
                        size="sm"
                        onClick={() => onCaricaMagazzino(dettaglio)}
                        title="Carica in magazzino"
                      >
                        📦
                      </CButton>
                    </CTableDataCell>
                  )}
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </div>
      </div>
    </div>
  );
};

export default DettagliFattura;