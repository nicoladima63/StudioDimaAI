import React, { useState, useEffect } from 'react';
import {
    CButton,
    CFormInput,
    CSpinner
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilChartPie, cilSettings } from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import AnalisiProduzione from '../components/AnalisiProduzione';
import { speseFornitioriService } from '@/features/spese/services/spese.service';
import type { ProduzioneOperatore } from '@/features/spese/types';

const CollaboratoriPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // State for Production
    const [startDate, setStartDate] = useState<string>(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState<string>(`${new Date().getFullYear()}-12-31`);
    const [productionData, setProductionData] = useState<ProduzioneOperatore[]>([]);
    const [availableYears, setAvailableYears] = useState<number[]>([]);

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

    // Load Available Years
    const loadYears = async () => {
        try {
            const response = await speseFornitioriService.getProductionYears();
            if (response.success && response.data) {
                setAvailableYears(response.data);
            }
        } catch (error) {
            console.error("Errore caricamento anni:", error);
        }
    };

    // Handle Year Selection
    const handleYearChange = (year: string) => {
        if (year) {
            setStartDate(`${year}-01-01`);
            setEndDate(`${year}-12-31`);
        }
    };

    // Load on mount
    useEffect(() => {
        loadYears();
        loadProduction();
    }, []);

    return (
        <PageLayout>
            <PageLayout.Header
                title="Collaboratori & Produzione"
                headerAction={
                    <CButton color="primary" onClick={loadProduction} disabled={loading}>
                        {loading ? (
                            <>
                                <CSpinner size="sm" className="me-2" />
                                Analisi in corso...
                            </>
                        ) : (
                            <>
                                <CIcon icon={cilSettings} className="me-2" />
                                Aggiorna Dati
                            </>
                        )}
                    </CButton>
                }
            />

            <PageLayout.ContentHeader>
                <div className="row align-items-end">
                    <div className="col-md-10">
                        <h5 className="mb-3">Filtri Periodo</h5>
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Seleziona Anno</label>
                                <select
                                    className="form-select"
                                    onChange={(e) => handleYearChange(e.target.value)}
                                    defaultValue={new Date().getFullYear()}
                                >
                                    <option value="">Seleziona...</option>
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Data Inizio</label>
                                <CFormInput
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Data Fine</label>
                                <CFormInput
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <div style={{ marginTop: '30px' }}>
                                    <CButton color="primary" className="w-100" onClick={loadProduction} disabled={loading}>
                                        <CIcon icon={cilChartPie} className="me-2" /> Analizza Periodo
                                    </CButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </PageLayout.ContentHeader>

            <PageLayout.ContentBody>
                {error && (
                    <div className="alert alert-danger" role="alert">
                        {error}
                    </div>
                )}

                <AnalisiProduzione data={productionData} loading={loading} />
            </PageLayout.ContentBody>
        </PageLayout>
    );
};

export default CollaboratoriPage;
