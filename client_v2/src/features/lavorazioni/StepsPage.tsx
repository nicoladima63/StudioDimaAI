
import React from 'react';
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CAlert
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSettings } from '@coreui/icons';

const StepsPage: React.FC = () => {
    // This page might be redundant if Steps are fully managed within Works, 
    // but can be used for global step analysis or advanced config.
    // For now simple placeholder or list of all steps.
    return (
        <CRow>
            <CCol xs={12}>
                <CCard className="mb-4">
                    <CCardHeader>
                        <strong>
                            <CIcon icon={cilSettings} className="me-2" />
                            Gestione Steps Template
                        </strong>
                    </CCardHeader>
                    <CCardBody>
                        <CAlert color="info">
                            La gestione degli Step è integrata principalmente nella pagina <strong>Works</strong>.
                            Qui in futuro sarà possibile visualizzare e gestire librerie di Step riutilizzabili.
                        </CAlert>
                    </CCardBody>
                </CCard>
            </CCol>
        </CRow>
    );
};

export default StepsPage;
