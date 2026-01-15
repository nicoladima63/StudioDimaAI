import React, { useState, useEffect } from 'react';
import {
    CCard,
    CCardBody,
    CRow,
    CCol,
    CFormSelect,
    CFormInput,
    CButton,
    CTable,
    CTableHead,
    CTableBody,
    CTableRow,
    CTableHeaderCell,
    CTableDataCell,
    CSpinner,
    CAlert,
    CNav,
    CNavItem,
    CNavLink,
    CTabContent,
    CTabPane,
    CBadge
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCloudDownload, cilMoney, cilChartPie, cilCalendar } from '@coreui/icons';
import { speseFornitioriService } from '../services/spese.service';
import type { RiepilogoFornitore, ProduzioneOperatore } from '../types';

const RiepilogoSpeseTab: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // State for Expenses
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [expensesData, setExpensesData] = useState<RiepilogoFornitore[]>([]);
    const [expensesMeta, setExpensesMeta] = useState({ grand_total: 0, count: 0 });

    // Load Expenses
    const loadExpenses = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await speseFornitioriService.getRiepilogoSpese(selectedYear);
            if (response.success) {
                setExpensesData(response.data);
                setExpensesMeta(response.meta);
            } else {
                setError(response.message || 'Errore durante il caricamento delle spese');
            }
        } catch (err: any) {
            setError(err.message || 'Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadExpenses();
    }, [selectedYear]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    return (
        <div>
            {error && (
                <CAlert color="danger" dismissible onClose={() => setError(null)}>
                    {error}
                </CAlert>
            )}

            {loading && (
                <div className="text-center my-5">
                    <CSpinner color="primary" />
                    <div className="mt-2">Elaborazione dati in corso...</div>
                </div>
            )}

            {!loading && (
                <>
                    <CRow className="mb-4 align-items-end">
                        <CCol md={3}>
                            <label className="form-label">Seleziona Anno</label>
                            <CFormSelect
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            >
                                {[2026, 2025, 2024, 2023, 2022].map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </CFormSelect>
                        </CCol>
                        <CCol md={9} className="text-end">
                            <div className="d-inline-block border rounded p-3 bg-light">
                                <small className="text-muted d-block uppercase">Totale Spese {selectedYear}</small>
                                <span className="fs-3 fw-bold text-danger">{formatCurrency(expensesMeta.grand_total)}</span>
                                <span className="ms-2 badge bg-secondary">{expensesMeta.count} Fornitori</span>
                            </div>
                        </CCol>
                    </CRow>

                    <CCard>
                        <CCardBody>
                            <CTable hover responsive striped>
                                <CTableHead>
                                    <CTableRow>
                                        <CTableHeaderCell>Codice Fornitore</CTableHeaderCell>
                                        <CTableHeaderCell className="text-end">N. Fatture</CTableHeaderCell>
                                        <CTableHeaderCell className="text-end">Imponibile</CTableHeaderCell>
                                        <CTableHeaderCell className="text-end">IVA</CTableHeaderCell>
                                        <CTableHeaderCell className="text-end">Totale</CTableHeaderCell>
                                    </CTableRow>
                                </CTableHead>
                                <CTableBody>
                                    {expensesData.length === 0 ? (
                                        <CTableRow>
                                            <CTableDataCell colSpan={5} className="text-center">Nessun dato trovato per l'anno selezionato.</CTableDataCell>
                                        </CTableRow>
                                    ) : (
                                        expensesData.map((row) => (
                                            <CTableRow key={row.codice_fornitore}>
                                                <CTableDataCell><strong>{row.codice_fornitore}</strong></CTableDataCell>
                                                <CTableDataCell className="text-end">{row.numero_fatture}</CTableDataCell>
                                                <CTableDataCell className="text-end">{formatCurrency(row.importo_netto)}</CTableDataCell>
                                                <CTableDataCell className="text-end">{formatCurrency(row.importo_iva)}</CTableDataCell>
                                                <CTableDataCell className="text-end fw-bold">{formatCurrency(row.importo_totale)}</CTableDataCell>
                                            </CTableRow>
                                        ))
                                    )}
                                </CTableBody>
                            </CTable>
                        </CCardBody>
                    </CCard>
                </>
            )}
        </div>
    );
};

export default RiepilogoSpeseTab;
