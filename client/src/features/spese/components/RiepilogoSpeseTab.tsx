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
    const [activeTab, setActiveTab] = useState<'spese' | 'produzione'>('spese');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // State for Expenses
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [expensesData, setExpensesData] = useState<RiepilogoFornitore[]>([]);
    const [expensesMeta, setExpensesMeta] = useState({ grand_total: 0, count: 0 });

    // State for Production
    const [startDate, setStartDate] = useState<string>(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState<string>(`${new Date().getFullYear()}-12-31`);
    const [productionData, setProductionData] = useState<ProduzioneOperatore[]>([]);

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

    // Load Production
    const loadProduction = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await speseFornitioriService.getAnalisiProduzioneOperatore(startDate, endDate);
            if (response.success) {
                setProductionData(response.data);
            } else {
                setError(response.message || 'Errore durante il caricamento della produzione');
            }
        } catch (err: any) {
            setError(err.message || 'Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'spese') {
            loadExpenses();
        } else {
            loadProduction();
        }
    }, [activeTab, selectedYear]); // Reload when tab or year changes (for expenses)

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    return (
        <div>
            <CNav variant="pills" className="mb-4">
                <CNavItem>
                    <CNavLink
                        active={activeTab === 'spese'}
                        onClick={() => setActiveTab('spese')}
                        style={{ cursor: 'pointer' }}
                    >
                        <CIcon icon={cilMoney} className="me-2" />
                        Spese Fornitori (Ciclo Passivo)
                    </CNavLink>
                </CNavItem>
                <CNavItem>
                    <CNavLink
                        active={activeTab === 'produzione'}
                        onClick={() => setActiveTab('produzione')}
                        style={{ cursor: 'pointer' }}
                    >
                        <CIcon icon={cilChartPie} className="me-2" />
                        Produzione Operatori (Ciclo Attivo)
                    </CNavLink>
                </CNavItem>
            </CNav>

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
                <CTabContent>
                    {/* TAB SPESE (PASSIVO) */}
                    <CTabPane visible={activeTab === 'spese'}>
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
                    </CTabPane>

                    {/* TAB PRODUZIONE (ATTIVO) */}
                    <CTabPane visible={activeTab === 'produzione'}>
                        <CRow className="mb-4 align-items-end">
                            <CCol md={3}>
                                <label className="form-label">Data Inizio</label>
                                <CFormInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </CCol>
                            <CCol md={3}>
                                <label className="form-label">Data Fine</label>
                                <CFormInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </CCol>
                            <CCol md={2}>
                                <CButton color="primary" className="w-100" onClick={loadProduction} style={{ marginTop: '30px' }}>
                                    <CIcon icon={cilChartPie} className="me-2" /> Analizza
                                </CButton>
                            </CCol>
                        </CRow>

                        <CRow>
                            {productionData.map((op) => (
                                <CCol xs={12} className="mb-4" key={op.operatore}>
                                    <CCard className="h-100 border-top-primary border-top-3">
                                        <CCardBody>
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h5 className="mb-0">{op.operatore}</h5>
                                                <CBadge color="success" className="fs-6">{formatCurrency(op.totale_periodo)}</CBadge>
                                            </div>
                                            <CTable small hover>
                                                <CTableBody>
                                                    {op.dettaglio_branche.map((b) => (
                                                        <CTableRow key={b.branca}>
                                                            <CTableDataCell>{b.branca}</CTableDataCell>
                                                            <CTableDataCell className="text-end">{formatCurrency(b.importo)}</CTableDataCell>
                                                            <CTableDataCell className="text-end" style={{ width: '80px' }}>
                                                                <small className="text-muted">{b.percentuale}%</small>
                                                            </CTableDataCell>
                                                        </CTableRow>
                                                    ))}
                                                </CTableBody>
                                            </CTable>
                                        </CCardBody>
                                    </CCard>
                                </CCol>
                            ))}
                            {productionData.length === 0 && !loading && (
                                <CCol xs={12}>
                                    <CAlert color="info">Nessun dato di produzione trovato per il periodo selezionato.</CAlert>
                                </CCol>
                            )}
                        </CRow>
                    </CTabPane>
                </CTabContent>
            )}
        </div>
    );
};

export default RiepilogoSpeseTab;
