import React from "react";
import { CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell, CBadge } from "@coreui/react";
import { SpesaFornitore } from "../types";

interface SpeseTableProps {
    spese: SpesaFornitore[];
    loading: boolean;
}

const SpeseTable: React.FC<SpeseTableProps> = ({ spese, loading }) => {
    if (loading) {
        return <div className="text-center p-3">Caricamento...</div>;
    }

    if (spese.length === 0) {
        return <div className="text-center p-3 text-muted">Nessuna spesa trovata</div>;
    }

    return (
        <CTable hover responsive>
            <CTableHead>
                <CTableRow>
                    <CTableHeaderCell>Data</CTableHeaderCell>
                    <CTableHeaderCell>Fornitore</CTableHeaderCell>
                    <CTableHeaderCell>Descrizione</CTableHeaderCell>
                    <CTableHeaderCell>Doc.</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Imponibile</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">IVA</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Totale</CTableHeaderCell>
                </CTableRow>
            </CTableHead>
            <CTableBody>
                {spese.map((spesa) => (
                    <CTableRow key={spesa.id}>
                        <CTableDataCell>
                            {spesa.data_spesa ? new Date(spesa.data_spesa).toLocaleDateString() : "-"}
                        </CTableDataCell>
                        <CTableDataCell>
                            <div>{spesa.nome_fornitore || spesa.codice_fornitore}</div>
                            <small className="text-muted">{spesa.codice_fornitore}</small>
                        </CTableDataCell>
                        <CTableDataCell>{spesa.descrizione}</CTableDataCell>
                        <CTableDataCell>{spesa.numero_documento}</CTableDataCell>
                        <CTableDataCell className="text-end">
                            {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(spesa.costo_netto || 0)}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                            {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(spesa.costo_iva || 0)}
                        </CTableDataCell>
                        <CTableDataCell className="text-end fw-bold">
                            {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((spesa.costo_netto || 0) + (spesa.costo_iva || 0))}
                        </CTableDataCell>
                    </CTableRow>
                ))}
            </CTableBody>
        </CTable>
    );
};

export default SpeseTable;
