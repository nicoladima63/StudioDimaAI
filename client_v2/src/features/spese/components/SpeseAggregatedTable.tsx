import React from 'react';
import {
    CTable,
    CTableBody,
    CTableHead,
    CTableHeaderCell,
    CTableRow,
    CTableDataCell,
    CButton,
    CBadge
} from '@coreui/react';

interface SpeseAggregatedTableProps {
    data: any[]; // Define specific type if possible
    loading: boolean;
    onSelectSupplier: (ids: string, name: string) => void;
}

const SpeseAggregatedTable: React.FC<SpeseAggregatedTableProps> = ({
    data,
    loading,
    onSelectSupplier
}) => {
    if (loading) {
        return <div className="text-center p-4">Caricamento...</div>;
    }

    if (!data || data.length === 0) {
        return <div className="text-center p-4">Nessun fornitore trovato</div>;
    }

    // Calculate totals for footer
    const totalNetto = data.reduce((acc, item) => acc + (item.importo_netto || 0), 0);
    const totalIva = data.reduce((acc, item) => acc + (item.importo_iva || 0), 0);
    const totalGrand = data.reduce((acc, item) => acc + (item.importo_totale || 0), 0);
    const totalInvoices = data.reduce((acc, item) => acc + (item.numero_fatture || 0), 0);

    return (
        <CTable hover responsive bordered striped className="align-middle">
            <CTableHead color="light">
                <CTableRow>
                    <CTableHeaderCell>Fornitore</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">N. Fatture</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Imponibile</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">IVA</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Totale</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">Azioni</CTableHeaderCell>
                </CTableRow>
            </CTableHead>
            <CTableBody>
                {data.map((item, index) => (
                    <CTableRow key={index} onClick={() => onSelectSupplier(item.id, item.nome)} style={{ cursor: 'pointer' }}>
                        <CTableDataCell>
                            <strong>{item.nome}</strong>
                        </CTableDataCell>
                        <CTableDataCell className="text-center">
                            <CBadge color="info" shape="rounded-pill">
                                {item.numero_fatture}
                            </CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                            {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(item.importo_netto)}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                            {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(item.importo_iva)}
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                            <strong>{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(item.importo_totale)}</strong>
                        </CTableDataCell>
                        <CTableDataCell className="text-center">
                            <CButton
                                color="primary"
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectSupplier(item.id, item.nome);
                                }}
                            >
                                Dettagli
                            </CButton>
                        </CTableDataCell>
                    </CTableRow>
                ))}
                {/* Footer Row with Totals */}
                <CTableRow color="secondary" className="fw-bold">
                    <CTableDataCell>TOTALE</CTableDataCell>
                    <CTableDataCell className="text-center">{totalInvoices}</CTableDataCell>
                    <CTableDataCell className="text-end">
                        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalNetto)}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalIva)}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalGrand)}
                    </CTableDataCell>
                    <CTableDataCell></CTableDataCell>
                </CTableRow>
            </CTableBody>
        </CTable>
    );
};

export default SpeseAggregatedTable;
