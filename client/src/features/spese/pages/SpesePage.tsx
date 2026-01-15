import React, { useState, useEffect } from "react";
import {
  CCol,
  CAlert,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CButton,
  CRow,
} from "@coreui/react";
import { Card } from "@/components/ui";
import FiltriSpeseComponent from "../components/FiltriSpese";
import RicercaArticoli from "../components/RicercaArticoli";
import RiepilogoSpeseTab from "../components/RiepilogoSpeseTab";
//import StatisticheCategorizzazione from "../components/StatisticheCategorizzazione";
//import ContiSottocontiTab from "../components/ContiSottocontiTab";
import { speseFornitioriService } from "../services/spese.service";
import type {
  FiltriSpese,
  SpesaFornitore,
  DettaglioSpesaFornitore,
} from "../types";

const SpesePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("fatture");
  const [filtri, setFiltri] = useState<FiltriSpese>({
    anno: new Date().getFullYear(),
    limit: 50,
    page: 1,
  });

  const [spese, setSpese] = useState<SpesaFornitore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalBeforeLimit, setTotalBeforeLimit] = useState(0);

  const caricaSpese = async (filtriSpecifici?: FiltriSpese) => {
    setLoading(true);
    setError(null);

    try {
      const filtriDaUsare = filtriSpecifici || filtri;
      const response = await speseFornitioriService.getSpeseFornitori(
        filtriDaUsare
      );

      if (response.success) {
        setSpese(response.data);
        setTotal(response.total);
        setTotalBeforeLimit(response.total_before_limit);
      } else {
        setError("Errore nel caricamento delle spese");
      }
    } catch (err: any) {
      console.error("Errore caricamento spese:", err);
      setError(err.message || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  // Carica spese al primo render e quando cambiano i filtri
  useEffect(() => {
    caricaSpese();
  }, []);

  const handleFiltriChange = (nuoviFiltri: FiltriSpese) => {
    setFiltri(nuoviFiltri);
  };

  const handleApplicaFiltri = () => {
    caricaSpese();
  };

  const handleTabellaFiltriChange = (nuoviFiltri: FiltriSpese) => {
    setFiltri(nuoviFiltri);
    // Auto-carica quando cambiano i filtri della tabella (paginazione)
    setTimeout(() => {
      caricaSpese();
    }, 50);
  };

  const calcolaTotale = () => {
    return spese.reduce((acc, spesa) => acc + spesa.costo_iva, 0);
  };

  const handleSelezionaFattura = (fatturaId: string) => {
    // Passa alla tab fatture
    setActiveTab("fatture");

    // Applica filtro ESCLUSIVO per quella fattura (rimuove altri filtri)
    const nuoviFiltri: FiltriSpese = {
      anno: new Date().getFullYear(),
      fattura_id: fatturaId,
      page: 1,
      limit: 50,
    };
    setFiltri(nuoviFiltri);

    // Ricarica i dati con i nuovi filtri direttamente
    caricaSpese(nuoviFiltri);
  };

  const handleCaricaMagazzino = (dettaglio: DettaglioSpesaFornitore) => {
    // TODO: Implementare logica caricamento magazzino
    console.log("Caricamento magazzino:", dettaglio);
    alert(
      `Caricamento magazzino non ancora implementato.\nArticolo: ${dettaglio.descrizione}`
    );
  };

  return (
    <Card title="Spese Fornitori">
      {/* Navigation Tabs */}
      <CNav variant="tabs" className="mb-4">
        <CNavItem>
          <CNavLink
            active={activeTab === "fatture"}
            onClick={() => setActiveTab("fatture")}
            style={{ cursor: "pointer" }}
          >
            📋 Fatture Fornitori
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === "ricerca"}
            onClick={() => setActiveTab("ricerca")}
            style={{ cursor: "pointer" }}
          >
            🔍 Ricerca Articoli
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === "statistiche"}
            onClick={() => setActiveTab("statistiche")}
            style={{ cursor: "pointer" }}
          >
            📊 Analisi & Riepilogo
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === "gestionale"}
            onClick={() => setActiveTab("gestionale")}
            style={{ cursor: "pointer" }}
          >
            🎯 Test Gestionale v2
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === "conti-sottoconti"}
            onClick={() => setActiveTab("conti-sottoconti")}
            style={{ cursor: "pointer" }}
          >
            🧾 Conti-Sottoconti
          </CNavLink>
        </CNavItem>
      </CNav>

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          {error}
        </CAlert>
      )}
      {/* Tab Content */}
      <CTabContent>
        {/* Fatture Tab */}
        <CTabPane visible={activeTab === "fatture"} role="tabpanel">
          <CRow className="mt-4">
            <CCol md={2}>
              <FiltriSpeseComponent
                filtri={filtri}
                onFiltriChange={handleFiltriChange}
                onApplicaFiltri={handleApplicaFiltri}
                loading={loading}
              />
            </CCol>
            <CCol md={10}>


            </CCol>
          </CRow>

          {/* Indicatore filtro specifico */}
          {filtri.fattura_id && (
            <CAlert color="warning" className="mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  🔍 <strong>Filtro attivo:</strong> Visualizzazione fattura
                  specifica ID: {filtri.fattura_id}
                </div>
                <CButton
                  color="warning"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiltri({
                      anno: new Date().getFullYear(),
                      limit: 50,
                      page: 1,
                    });
                    setTimeout(() => caricaSpese(), 50);
                  }}
                >
                  ✕ Rimuovi Filtro
                </CButton>
              </div>
            </CAlert>
          )}

          {/* Riepilogo rapido */}
          {spese.length > 0 && (
            <CAlert color="info" className="mb-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>Riepilogo:</strong> {spese.length} spese trovate
                </div>
                <div>
                  <strong>Totale con IVA:</strong>{" "}
                  {new Intl.NumberFormat("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  }).format(calcolaTotale())}
                </div>
              </div>
            </CAlert>
          )}

        </CTabPane>

        {/* Ricerca Articoli Tab */}
        <CTabPane visible={activeTab === "ricerca"} role="tabpanel">
          <RicercaArticoli
            onSelezionaFattura={handleSelezionaFattura}
            onCaricaMagazzino={handleCaricaMagazzino}
            autoFocus={activeTab === "ricerca"}
          />
        </CTabPane>

        {/* Statistiche Categorizzazione Tab */}
        <CTabPane visible={activeTab === "statistiche"} role="tabpanel">
          <RiepilogoSpeseTab />
        </CTabPane>

        {/* Conti-Sottoconti Tab */}
        <CTabPane visible={activeTab === "conti-sottoconti"} role="tabpanel">
          <ContiSottocontiTab />
        </CTabPane>

      </CTabContent>
    </Card>
  );
};

export default SpesePage;
