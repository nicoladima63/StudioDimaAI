import React, { useEffect, useState } from 'react';
import {
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CProgress,
    CProgressBar,
    CSpinner,
    CAlert,
    CListGroup,
    CListGroupItem
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheckCircle, cilXCircle, cilWarning, cilSync } from '@coreui/icons';
import { calendarHealthService, type AutoSyncJobStatus } from '../services/calendarHealthCheck';

interface AutoSyncModalProps {
    visible: boolean;
    jobId: string | null;
    onComplete: () => void;
}

export const AutoSyncModal: React.FC<AutoSyncModalProps> = ({ visible, jobId, onComplete }) => {
    const [jobStatus, setJobStatus] = useState<AutoSyncJobStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible || !jobId) return;

        const pollInterval = setInterval(async () => {
            try {
                const status = await calendarHealthService.checkAutoSyncJobStatus(jobId);
                setJobStatus(status);

                if (status.status === 'completed' || status.status === 'error') {
                    clearInterval(pollInterval);
                    if (status.status === 'completed') {
                        setTimeout(() => {
                            onComplete();
                        }, 3000); // Chiudi dopo 3 secondi
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Errore durante il polling');
                clearInterval(pollInterval);
            }
        }, 1000); // Poll ogni secondo

        return () => clearInterval(pollInterval);
    }, [visible, jobId, onComplete]);

    if (!visible) return null;

    // Helper per determinare lo stato di una fase
    const getPhaseStatus = (phaseName: string): 'pending' | 'in_progress' | 'completed' | 'error' => {
        if (!jobStatus) return 'pending';
        if (jobStatus.status === 'error') return 'error';

        if (phaseName === 'pre_check') {
            if (jobStatus.pre_check?.completed) return 'completed';
            if (jobStatus.phase === 'pre_check') return 'in_progress';
            return 'pending';
        }

        if (phaseName === 'clearing') {
            if (jobStatus.phase === 'completed' || jobStatus.phase.startsWith('syncing_week_')) return 'completed';
            if (jobStatus.phase === 'clearing') return 'in_progress';
            if (jobStatus.pre_check?.completed) return 'pending';
            return 'pending';
        }

        if (phaseName === 'syncing') {
            if (jobStatus.phase === 'completed') return 'completed';
            if (jobStatus.phase.startsWith('syncing_week_')) return 'in_progress';
            return 'pending';
        }

        return 'pending';
    };

    const renderPhaseIcon = (status: 'pending' | 'in_progress' | 'completed' | 'error') => {
        switch (status) {
            case 'completed':
                return <CIcon icon={cilCheckCircle} className="text-success" />;
            case 'in_progress':
                return <CSpinner size="sm" className="text-primary" />;
            case 'error':
                return <CIcon icon={cilXCircle} className="text-danger" />;
            default:
                return <CIcon icon={cilSync} className="text-muted" />;
        }
    };

    const preCheckStatus = getPhaseStatus('pre_check');
    const clearingStatus = getPhaseStatus('clearing');
    const syncingStatus = getPhaseStatus('syncing');

    return (
        <CModal
            visible={visible}
            backdrop="static"
            keyboard={false}
            alignment="center"
            size="lg"
        >
            <CModalHeader>
                <CModalTitle>Primo Avvio - Configurazione Automatica</CModalTitle>
            </CModalHeader>
            <CModalBody>
                {error && (
                    <CAlert color="danger">
                        <strong>Errore:</strong> {error}
                    </CAlert>
                )}

                {jobStatus && jobStatus.status === 'error' && (
                    <CAlert color="danger">
                        <strong>Errore durante la configurazione:</strong> {jobStatus.error}
                    </CAlert>
                )}

                {jobStatus && jobStatus.status === 'completed' && (
                    <CAlert color="success">
                        <strong>Completato!</strong> {jobStatus.message}
                    </CAlert>
                )}

                {/* Barra di progresso generale */}
                <div className="mb-4">
                    <CProgress className="mb-2">
                        <CProgressBar value={jobStatus?.progress || 0} color="primary">
                            {jobStatus?.progress || 0}%
                        </CProgressBar>
                    </CProgress>
                    <small className="text-muted">{jobStatus?.message || 'Inizializzazione...'}</small>
                </div>

                {/* Lista fasi dettagliate */}
                <CListGroup>
                    {/* FASE 1: Pre-check Requisiti */}
                    <CListGroupItem
                        className={preCheckStatus === 'completed' ? 'text-decoration-line-through opacity-75' : ''}
                    >
                        <div className="d-flex align-items-center">
                            <div className="me-3">{renderPhaseIcon(preCheckStatus)}</div>
                            <div className="flex-grow-1">
                                <strong>1. Verifica Requisiti</strong>
                                {jobStatus?.pre_check && (
                                    <div className="mt-2 ms-4 small">
                                        <div className="d-flex align-items-center mb-1">
                                            {jobStatus.pre_check.token_exists ? (
                                                <CIcon icon={cilCheckCircle} className="text-success me-2" size="sm" />
                                            ) : (
                                                <CIcon icon={cilXCircle} className="text-danger me-2" size="sm" />
                                            )}
                                            <span>Token OAuth (token.json) - {jobStatus.pre_check.token_exists ? 'OK' : 'MANCANTE'}</span>
                                        </div>
                                        <div className="d-flex align-items-center mb-1">
                                            {jobStatus.pre_check.credentials_exist ? (
                                                <CIcon icon={cilCheckCircle} className="text-success me-2" size="sm" />
                                            ) : (
                                                <CIcon icon={cilXCircle} className="text-danger me-2" size="sm" />
                                            )}
                                            <span>Credenziali Google (credentials.json) - {jobStatus.pre_check.credentials_exist ? 'OK' : 'MANCANTE'}</span>
                                        </div>
                                        <div className="d-flex align-items-center">
                                            {jobStatus.pre_check.sync_state_exists ? (
                                                <CIcon icon={cilCheckCircle} className="text-success me-2" size="sm" />
                                            ) : (
                                                <CIcon icon={cilWarning} className="text-warning me-2" size="sm" />
                                            )}
                                            <span>Stato sincronizzazione (sync_state.json) - {jobStatus.pre_check.sync_state_exists ? 'OK' : 'ASSENTE - Richiesto setup'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CListGroupItem>

                    {/* FASE 2: Pulizia Calendar */}
                    <CListGroupItem
                        className={clearingStatus === 'completed' ? 'text-decoration-line-through opacity-75' : ''}
                    >
                        <div className="d-flex align-items-center">
                            <div className="me-3">{renderPhaseIcon(clearingStatus)}</div>
                            <div className="flex-grow-1">
                                <strong>2. Pulizia Google Calendar</strong>
                                {jobStatus && jobStatus.cleared > 0 && (
                                    <div className="mt-1 ms-4 small text-muted">
                                        Eventi rimossi: <strong>{jobStatus.cleared}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CListGroupItem>

                    {/* FASE 3: Sincronizzazione */}
                    <CListGroupItem
                        className={syncingStatus === 'completed' ? 'text-decoration-line-through opacity-75' : ''}
                    >
                        <div className="d-flex align-items-center">
                            <div className="me-3">{renderPhaseIcon(syncingStatus)}</div>
                            <div className="flex-grow-1">
                                <strong>3. Sincronizzazione Appuntamenti</strong>
                                {jobStatus && syncingStatus !== 'pending' && (
                                    <div className="mt-2 ms-4 small">
                                        <div className="mb-1">
                                            Settimana: <strong>{jobStatus.current_week}/{jobStatus.total_weeks}</strong>
                                        </div>
                                        <div className="mb-1">
                                            Range: <span className="text-muted">{jobStatus.start_date} - {jobStatus.end_date}</span>
                                        </div>
                                        <div>
                                            Eventi sincronizzati: <strong>{jobStatus.synced}</strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CListGroupItem>
                </CListGroup>

                {!jobStatus && !error && (
                    <div className="text-center mt-4">
                        <CSpinner />
                        <p className="mt-2">Avvio configurazione...</p>
                    </div>
                )}
            </CModalBody>
        </CModal>
    );
};
