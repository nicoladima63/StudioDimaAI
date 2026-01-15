import React from 'react';
import {
    CCard,
    CCardBody,
    CRow,
    CCol,
    CTable,
    CTableBody,
    CTableRow,
    CTableDataCell,
    CSpinner,
    CAlert,
    CBadge
} from '@coreui/react';
import type { ProduzioneOperatore } from '@/features/spese/types';

interface AnalisiProduzioneProps {
    data: ProduzioneOperatore[];
    loading: boolean;
}

const AnalisiProduzione: React.FC<AnalisiProduzioneProps> = ({ data, loading }) => {

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    if (loading) {
        return (
            <div className="text-center my-5">
                <CSpinner color="primary" />
                <div className="mt-2">Elaborazione dati in corso...</div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <CAlert color="info">
                Nessun dato di produzione trovato per il periodo selezionato.
            </CAlert>
        );
    }

    return (
        <CRow>
            {data.map((op) => (
                <CCol xs={12} lg={6} xl={4} className="mb-4" key={op.operatore}>
                    <CCard className="h-100 border-top-primary border-top-3 shadow-sm">
                        <CCardBody>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0 fw-bold">{op.operatore}</h5>
                                <CBadge color="success" className="fs-6">{formatCurrency(op.totale_periodo)}</CBadge>
                            </div>
                            <CTable small hover borderless className="mb-0">
                                <CTableBody>
                                    {op.dettaglio_branche.map((b) => (
                                        <CTableRow key={b.branca} className="align-middle">
                                            <CTableDataCell>{b.branca}</CTableDataCell>
                                            <CTableDataCell className="text-end fw-semibold">{formatCurrency(b.importo)}</CTableDataCell>
                                            <CTableDataCell className="text-end text-muted" style={{ width: '60px' }}>
                                                <small>{b.percentuale}%</small>
                                            </CTableDataCell>
                                        </CTableRow>
                                    ))}
                                </CTableBody>
                            </CTable>
                        </CCardBody>
                    </CCard>
                </CCol>
            ))}
        </CRow>
    );
};

export default AnalisiProduzione;
