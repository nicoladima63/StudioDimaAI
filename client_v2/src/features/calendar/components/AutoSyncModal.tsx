import React, { useEffect, useState } from 'react';
import {
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CProgress,
    CProgressBar,
    CSpinner,
    CAlert
} from '@coreui/react';
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
                        }, 2000); // Chiudi dopo 2 secondi
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

    return (
        <CModal
            visible={visible}
            backdrop="static"
            keyboard={false}
            alignment="center"
        >
            <CModalHeader>
                <CModalTitle>Primo Avvio - Sincronizzazione Automatica</CModalTitle>
            </CModalHeader>
            <CModalBody>
                {error && (
                    <CAlert color="danger">
                        <strong>Errore:</strong> {error}
                    </CAlert>
                )}

                {jobStatus && jobStatus.status === 'error' && (
                    <CAlert color="danger">
                        <strong>Errore durante la sincronizzazione:</strong> {jobStatus.error}
                    </CAlert>
                )}

                {jobStatus && jobStatus.status === 'completed' && (
                    <CAlert color="success">
                        <strong>Completato!</strong> {jobStatus.message}
                    </CAlert>
                )}

                {jobStatus && jobStatus.status === 'in_progress' && (
                    <>
                        <div className="mb-3">
                            <p className="mb-2">
                                <strong>{jobStatus.message}</strong>
                            </p>
                            <CProgress className="mb-3">
                                <CProgressBar value={jobStatus.progress} color="primary">
                                    {jobStatus.progress}%
                                </CProgressBar>
                            </CProgress>
                        </div>

                        <div className="text-muted small">
                            {jobStatus.phase === 'clearing' && (
                                <div className="d-flex align-items-center">
                                    <CSpinner size="sm" className="me-2" />
                                    <span>Pulizia Google Calendar in corso...</span>
                                </div>
                            )}

                            {jobStatus.phase.startsWith('syncing_week_') && (
                                <div>
                                    <div className="d-flex align-items-center mb-2">
                                        <CSpinner size="sm" className="me-2" />
                                        <span>Sincronizzazione settimana {jobStatus.current_week}/{jobStatus.total_weeks}</span>
                                    </div>
                                    <div>
                                        <small>
                                            Range: {jobStatus.start_date} - {jobStatus.end_date}
                                        </small>
                                    </div>
                                </div>
                            )}

                            <div className="mt-3">
                                <div>Eventi rimossi: <strong>{jobStatus.cleared}</strong></div>
                                <div>Eventi sincronizzati: <strong>{jobStatus.synced}</strong></div>
                            </div>
                        </div>
                    </>
                )}

                {!jobStatus && !error && (
                    <div className="text-center">
                        <CSpinner />
                        <p className="mt-2">Avvio sincronizzazione...</p>
                    </div>
                )}
            </CModalBody>
        </CModal>
    );
};
