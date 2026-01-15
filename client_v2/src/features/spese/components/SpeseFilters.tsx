import React, { useState, useEffect } from "react";
import {
    CRow,
    CCol,
    CFormSelect,
    CButton,
    CCard,
    CCardBody,
    CCardHeader,
} from "@coreui/react";
import { FiltriSpese } from "../types";
import classificazioniService from "../../fornitori/services/classificazioni.service";
import { speseFornitioriService } from "../services/spese.service";

interface SpeseFiltersProps {
    filtri: FiltriSpese;
    onFiltriChange: (filtri: FiltriSpese) => void;
    loading: boolean;
}

const SpeseFilters: React.FC<SpeseFiltersProps> = ({
    filtri,
    onFiltriChange,
    loading,
}) => {
    const [conti, setConti] = useState<any[]>([]);
    const [branche, setBranche] = useState<any[]>([]);
    const [sottoconti, setSottoconti] = useState<any[]>([]);
    const [fornitori, setFornitori] = useState<{ id: string, nome: string }[]>([]);
    const [anni, setAnni] = useState<number[]>([]);

    // 1. Init: Load Conti & Years
    useEffect(() => {
        const fetchConti = async () => {
            try {
                const response = await classificazioniService.getConti();
                if (response.success && Array.isArray(response.data)) {
                    setConti(response.data);
                }
            } catch (error) {
                console.error("Errore caricamento conti:", error);
            }
        };

        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = 0; i < 5; i++) {
            years.push(currentYear - i);
        }
        setAnni(years);

        fetchConti();
    }, []);

    // 2. Cascade: Load Branche when Conto changes
    useEffect(() => {
        const fetchBranche = async () => {
            if (!filtri.conto_id) {
                setBranche([]);
                return;
            }
            try {
                const response = await classificazioniService.getBranche(filtri.conto_id);
                if (response.success && Array.isArray(response.data)) {
                    setBranche(response.data);
                }
            } catch (error) {
                console.error("Errore caricamento branche:", error);
                setBranche([]);
            }
        };
        fetchBranche();
    }, [filtri.conto_id]);

    // 3. Cascade: Load Sottoconti when Branca changes
    useEffect(() => {
        const fetchSottoconti = async () => {
            if (!filtri.branca_id) {
                setSottoconti([]);
                return;
            }
            try {
                const response = await classificazioniService.getSottoconti(filtri.branca_id);
                if (response.success && Array.isArray(response.data)) {
                    setSottoconti(response.data);
                }
            } catch (error) {
                console.error("Errore caricamento sottoconti:", error);
                setSottoconti([]);
            }
        };
        fetchSottoconti();
    }, [filtri.branca_id]);

    // 4. Update Active Suppliers based on all filters
    useEffect(() => {
        const fetchActiveSuppliers = async () => {
            try {
                const response = await speseFornitioriService.getActiveSuppliers(filtri);
                if (response.success && Array.isArray(response.data)) {
                    setFornitori(response.data);
                }
            } catch (error) {
                console.error("Errore caricamento fornitori:", error);
            }
        };
        // Debounce slightly or just call
        fetchActiveSuppliers();
    }, [filtri.anno, filtri.conto_id, filtri.branca_id, filtri.sottoconto_id]);


    const handleChange = (
        field: keyof FiltriSpese,
        value: string | number | undefined
    ) => {
        const newFiltri = { ...filtri };

        if ((value === undefined || value === '') && field !== 'anno') {
            delete newFiltri[field];
        } else {
            (newFiltri as any)[field] = value;
        }

        // Reset sub-filters if parent changes
        if (field === 'conto_id') {
            delete newFiltri.branca_id;
            delete newFiltri.sottoconto_id;
            delete newFiltri.codice_fornitore;
        } else if (field === 'branca_id') {
            delete newFiltri.sottoconto_id;
            delete newFiltri.codice_fornitore;
        } else if (field === 'sottoconto_id') {
            delete newFiltri.codice_fornitore;
        }

        newFiltri.page = 1;
        onFiltriChange(newFiltri);
    };

    return (
        <CCard className="mb-4">
            <CCardHeader>
                <strong>Filtri Analisi</strong>
            </CCardHeader>
            <CCardBody>
                <CRow className="g-3">
                    {/* Filtro Anno */}
                    <CCol md={2}>
                        <label className="form-label">Anno</label>
                        <CFormSelect
                            value={filtri.anno}
                            onChange={(e) => handleChange("anno", parseInt(e.target.value))}
                            disabled={loading}
                        >
                            {anni.map((anno) => (
                                <option key={anno} value={anno}>
                                    {anno}
                                </option>
                            ))}
                        </CFormSelect>
                    </CCol>

                    {/* Filtro 1: Categoria (Conto) */}
                    <CCol md={3}>
                        <label className="form-label">Categoria</label>
                        <CFormSelect
                            value={filtri.conto_id || ""}
                            onChange={(e) =>
                                handleChange("conto_id", e.target.value || undefined)
                            }
                            disabled={loading}
                        >
                            <option value="">Tutte le categorie</option>
                            {conti
                                .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                                .map((conto) => (
                                    <option key={conto.id} value={conto.id}>
                                        {conto.nome}
                                    </option>
                                ))}
                        </CFormSelect>
                    </CCol>

                    {/* Filtro 2: Branca (visibile solo se ci sono branche) */}
                    <CCol md={3}>
                        <label className="form-label">Branca</label>
                        <CFormSelect
                            value={filtri.branca_id || ""}
                            onChange={(e) =>
                                handleChange("branca_id", e.target.value || undefined)
                            }
                            disabled={loading || !filtri.conto_id || branche.length === 0}
                        >
                            <option value="">Tutte le branche</option>
                            {branche
                                .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                                .map((branca) => (
                                    <option key={branca.id} value={branca.id}>
                                        {branca.nome}
                                    </option>
                                ))}
                        </CFormSelect>
                    </CCol>

                    {/* Filtro 3: Sottoconto (visibile solo se ci sono sottoconti) */}
                    <CCol md={2}>
                        <label className="form-label">Dettaglio</label>
                        <CFormSelect
                            value={filtri.sottoconto_id || ""}
                            onChange={(e) =>
                                handleChange("sottoconto_id", e.target.value || undefined)
                            }
                            disabled={loading || !filtri.branca_id || sottoconti.length === 0}
                        >
                            <option value="">Tutti i dettagli</option>
                            {sottoconti
                                .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                                .map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                        {sub.nome}
                                    </option>
                                ))}
                        </CFormSelect>
                    </CCol>


                </CRow>
                <CRow className="mt-3">
                    <CCol md={12} className="d-flex justify-content-end">
                        <CButton
                            color="secondary"
                            variant="outline"
                            onClick={() => {
                                onFiltriChange({
                                    anno: new Date().getFullYear(),
                                    limit: 50,
                                    page: 1,
                                });
                            }}
                            disabled={loading}
                        >
                            Reset Filtri
                        </CButton>
                    </CCol>
                </CRow>
            </CCardBody>
        </CCard>
    );
};

export default SpeseFilters;
