import React, { useState, useEffect } from 'react';
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CButton,
    CSpinner,
    CAlert,
    CTable,
    CTableHead,
    CTableBody,
    CTableHeaderCell,
    CTableRow,
    CTableDataCell,
    CBadge,
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CModalFooter,
    CForm,
    CFormInput,
    CFormLabel,
    CFormSelect,

    CNav,
    CNavItem,
    CNavLink,
    CTabContent,
    CTabPane
} from '@coreui/react';
import { cilClock, cilMediaPlay, cilMediaStop, cilSettings, cilReload } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import toast from 'react-hot-toast';
import { schedulerService } from '../services/schedulerService';

interface SchedulerJob {
    id: string;
    name: string;
    next_run: string | null;
    trigger: string;
}

interface SchedulerStatus {
    running: boolean;
    jobs: SchedulerJob[];
}

interface SchedulerSettings {
    reminder_enabled: boolean;
    reminder_hour: number;
    reminder_minute: number;
    recall_enabled: boolean;
    recall_hour: number;
    recall_minute: number;
    calendar_sync_enabled: boolean;
    calendar_sync_hour?: number;
    calendar_sync_minute?: number;
    calendar_studio_blu_id: string;
    calendar_studio_giallo_id: string;
}

interface LogEntry {
    timestamp: string;
    sent?: number;
    success?: number;
    errors?: Array<{
        paziente: string;
        numero: string;
        errore: string;
    }>;
    total_synced?: number;
    total_errors?: number;
    months_processed?: number;
}

const SchedulerPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('status');
    const [status, setStatus] = useState<SchedulerStatus | null>(null);
    const [settings, setSettings] = useState<SchedulerSettings | null>(null);
    const [recallLogs, setRecallLogs] = useState<LogEntry[]>([]);
    const [calendarLogs, setCalendarLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [editingService, setEditingService] = useState<'reminder' | 'recall' | 'calendar' | null>(null);
    const [tempSettings, setTempSettings] = useState<Partial<SchedulerSettings>>({});

    useEffect(() => {
        loadSchedulerData();
    }, []);

    const loadSchedulerData = async () => {
        setLoading(true);
        try {
            const data = await schedulerService.apiGetStatus();
            setStatus(data.scheduler);
            setSettings(data.settings);
        } catch (error) {
            toast.error('Errore caricamento dati scheduler');
            console.error('Error loading scheduler data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLogs = async (type: 'recall' | 'calendar') => {
        try {
            const logs = await schedulerService.apiGetLogs(type);
            if (type === 'recall') {
                setRecallLogs(logs);
            } else {
                setCalendarLogs(logs);
            }
        } catch (error) {
            toast.error(`Errore caricamento log ${type}`);
        }
    };

    const handleStartStop = async (action: 'start' | 'stop') => {
        setLoading(true);
        try {
            if (action === 'start') {
                await schedulerService.apiStart();
                toast.success('Scheduler avviato');
            } else {
                await schedulerService.apiStop();
                toast('Scheduler fermato');
            }
            await loadSchedulerData();
        } catch (error) {
            toast.error(`Errore ${action} scheduler`);
        } finally {
            setLoading(false);
        }
    };

    const handleEditSettings = (service: 'reminder' | 'recall' | 'calendar') => {
        if (!settings) return;

        setEditingService(service);

        if (service === 'reminder') {
            setTempSettings({
                reminder_enabled: settings.reminder_enabled,
                reminder_hour: settings.reminder_hour,
                reminder_minute: settings.reminder_minute
            });
        } else if (service === 'recall') {
            setTempSettings({
                recall_enabled: settings.recall_enabled,
                recall_hour: settings.recall_hour,
                recall_minute: settings.recall_minute
            });
        } else if (service === 'calendar') {
            setTempSettings({
                calendar_sync_enabled: settings.calendar_sync_enabled,
                calendar_sync_hour: settings.calendar_sync_hour ?? 0,
                calendar_sync_minute: settings.calendar_sync_minute ?? 0,
                calendar_studio_blu_id: settings.calendar_studio_blu_id,
                calendar_studio_giallo_id: settings.calendar_studio_giallo_id
            });
        }

        setShowSettingsModal(true);
    };

    const handleSaveSettings = async () => {
        if (!editingService) return;

        setLoading(true);
        try {
            await schedulerService.apiUpdateSettings(editingService, tempSettings);
            toast.success(`Impostazioni ${editingService} aggiornate`);
            setShowSettingsModal(false);
            await loadSchedulerData();
        } catch (error) {
            toast.error('Errore aggiornamento impostazioni');
        } finally {
            setLoading(false);
        }
    };

    const formatNextRun = (nextRun: string | null) => {
        if (!nextRun) return 'Non programmato';
        return new Date(nextRun).toLocaleString('it-IT');
    };

    const getServiceStatus = (service: 'reminder' | 'recall' | 'calendar') => {
        if (!settings || !status) return { enabled: false, nextRun: null };

        let enabled = false;
        let jobId = '';

        if (service === 'reminder') {
            enabled = settings.reminder_enabled;
            jobId = 'reminder_job_v2';
        } else if (service === 'recall') {
            enabled = settings.recall_enabled;
            jobId = 'recall_job_v2';
        } else if (service === 'calendar') {
            enabled = settings.calendar_sync_enabled;
            jobId = 'calendar_sync_job_v2';
        }

        const job = status.jobs.find(j => j.id === jobId);
        return { enabled, nextRun: job?.next_run || null };
    };

    if (loading && !status) {
        return (
            <div className="d-flex justify-content-center p-4">
                <CSpinner />
            </div>
        );
    }

    return (
        <div className="scheduler-page">
            <CRow>
                <CCol xs={12}>
                    <CCard>
                        <CCardHeader className="d-flex justify-content-between align-items-center">
                            <h5>Gestione Automazioni - Scheduler</h5>
                            <div>
                                <CButton
                                    color="info"
                                    size="sm"
                                    className="me-2"
                                    onClick={loadSchedulerData}
                                    disabled={loading}
                                >
                                    <CIcon icon={cilReload} className="me-1" />
                                    Aggiorna
                                </CButton>
                                {status?.running ? (
                                    <CButton
                                        color="warning"
                                        size="sm"
                                        onClick={() => handleStartStop('stop')}
                                        disabled={loading}
                                    >
                                        <CIcon icon={cilMediaStop} className="me-1" />
                                        Ferma Scheduler
                                    </CButton>
                                ) : (
                                    <CButton
                                        color="success"
                                        size="sm"
                                        onClick={() => handleStartStop('start')}
                                        disabled={loading}
                                    >
                                        <CIcon icon={cilMediaPlay} className="me-1" />
                                        Avvia Scheduler
                                    </CButton>
                                )}
                            </div>
                        </CCardHeader>

                        <CCardBody>
                            <CNav variant="tabs" role="tablist">
                                <CNavItem>
                                    <CNavLink
                                        href="#"
                                        active={activeTab === 'status'}
                                        onClick={() => setActiveTab('status')}
                                    >
                                        <CIcon icon={cilClock} className="me-1" />
                                        Status & Jobs
                                    </CNavLink>
                                </CNavItem>
                                <CNavItem>
                                    <CNavLink
                                        href="#"
                                        active={activeTab === 'logs'}
                                        onClick={() => {
                                            setActiveTab('logs');
                                            loadLogs('recall');
                                            loadLogs('calendar');
                                        }}
                                    >
                                        Log Attività
                                    </CNavLink>
                                </CNavItem>
                            </CNav>

                            <CTabContent>
                                <CTabPane visible={activeTab === 'status'}>
                                    <div className="mt-3">
                                        <CAlert color={status?.running ? 'success' : 'warning'}>
                                            <strong>Scheduler Status:</strong> {status?.running ? 'ATTIVO' : 'INATTIVO'}
                                        </CAlert>

                                        <h6>Servizi Programmati</h6>
                                        <CTable striped>
                                            <CTableHead>
                                                <CTableRow>
                                                    <CTableHeaderCell>Servizio</CTableHeaderCell>
                                                    <CTableHeaderCell>Stato</CTableHeaderCell>
                                                    <CTableHeaderCell>Orario</CTableHeaderCell>
                                                    <CTableHeaderCell>Prossima Esecuzione</CTableHeaderCell>
                                                    <CTableHeaderCell>Azioni</CTableHeaderCell>
                                                </CTableRow>
                                            </CTableHead>
                                            <CTableBody>
                                                {/* Promemoria Appuntamenti */}
                                                <CTableRow>
                                                    <CTableDataCell>Promemoria Appuntamenti</CTableDataCell>
                                                    <CTableDataCell>
                                                        <CBadge color={getServiceStatus('reminder').enabled ? 'success' : 'secondary'}>
                                                            {getServiceStatus('reminder').enabled ? 'ATTIVO' : 'DISABILITATO'}
                                                        </CBadge>
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        {settings && settings.reminder_hour !== undefined ? `${settings.reminder_hour.toString().padStart(2, '0')}:${settings.reminder_minute?.toString().padStart(2, '0')}` : '-'}
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        {formatNextRun(getServiceStatus('reminder').nextRun)}
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        <CButton
                                                            color="primary"
                                                            size="sm"
                                                            onClick={() => handleEditSettings('reminder')}
                                                        >
                                                            <CIcon icon={cilSettings} className="me-1" />
                                                            Configura
                                                        </CButton>
                                                    </CTableDataCell>
                                                </CTableRow>

                                                {/* Richiami Pazienti */}
                                                <CTableRow>
                                                    <CTableDataCell>Richiami Pazienti</CTableDataCell>
                                                    <CTableDataCell>
                                                        <CBadge color={getServiceStatus('recall').enabled ? 'success' : 'secondary'}>
                                                            {getServiceStatus('recall').enabled ? 'ATTIVO' : 'DISABILITATO'}
                                                        </CBadge>
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        {settings && settings.recall_hour !== undefined ? `${settings.recall_hour.toString().padStart(2, '0')}:${settings.recall_minute?.toString().padStart(2, '0')}` : '-'}
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        {formatNextRun(getServiceStatus('recall').nextRun)}
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        <CButton
                                                            color="primary"
                                                            size="sm"
                                                            onClick={() => handleEditSettings('recall')}
                                                        >
                                                            <CIcon icon={cilSettings} className="me-1" />
                                                            Configura
                                                        </CButton>
                                                    </CTableDataCell>
                                                </CTableRow>

                                                {/* Sincronizzazione Calendario */}
                                                <CTableRow>
                                                    <CTableDataCell>Sincronizzazione Calendario</CTableDataCell>
                                                    <CTableDataCell>
                                                        <CBadge color={getServiceStatus('calendar').enabled ? 'success' : 'secondary'}>
                                                            {getServiceStatus('calendar').enabled ? 'ATTIVO' : 'DISABILITATO'}
                                                        </CBadge>
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        {settings && settings.calendar_sync_hour !== undefined ? `${settings.calendar_sync_hour.toString().padStart(2, '0')}:${settings.calendar_sync_minute?.toString().padStart(2, '0')}` : '-'}
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        {formatNextRun(getServiceStatus('calendar').nextRun)}
                                                    </CTableDataCell>
                                                    <CTableDataCell>
                                                        <CButton
                                                            color="primary"
                                                            size="sm"
                                                            onClick={() => handleEditSettings('calendar')}
                                                        >
                                                            <CIcon icon={cilSettings} className="me-1" />
                                                            Configura
                                                        </CButton>
                                                    </CTableDataCell>
                                                </CTableRow>
                                            </CTableBody>
                                        </CTable>
                                    </div>
                                </CTabPane>

                                <CTabPane visible={activeTab === 'logs'}>
                                    <div className="mt-3">
                                        <CRow>
                                            <CCol md={6}>
                                                <h6>Log Richiami (Ultimi 10)</h6>
                                                {recallLogs.length > 0 ? (
                                                    <CTable>
                                                        <CTableHead>
                                                            <CTableRow>
                                                                <CTableHeaderCell>Data/Ora</CTableHeaderCell>
                                                                <CTableHeaderCell>Inviati</CTableHeaderCell>
                                                                <CTableHeaderCell>Errori</CTableHeaderCell>
                                                            </CTableRow>
                                                        </CTableHead>
                                                        <CTableBody>
                                                            {recallLogs.slice(-10).map((log, index) => (
                                                                <CTableRow key={index}>
                                                                    <CTableDataCell>
                                                                        {new Date(log.timestamp).toLocaleString('it-IT')}
                                                                    </CTableDataCell>
                                                                    <CTableDataCell>
                                                                        <CBadge color="success">{log.sent || 0}</CBadge>
                                                                    </CTableDataCell>
                                                                    <CTableDataCell>
                                                                        <CBadge color="danger">{log.errors?.length || 0}</CBadge>
                                                                    </CTableDataCell>
                                                                </CTableRow>
                                                            ))}
                                                        </CTableBody>
                                                    </CTable>
                                                ) : (
                                                    <CAlert color="info">Nessun log richiami disponibile</CAlert>
                                                )}
                                            </CCol>

                                            <CCol md={6}>
                                                <h6>Log Sincronizzazione Calendario (Ultimi 10)</h6>
                                                {calendarLogs.length > 0 ? (
                                                    <CTable>
                                                        <CTableHead>
                                                            <CTableRow>
                                                                <CTableHeaderCell>Data/Ora</CTableHeaderCell>
                                                                <CTableHeaderCell>Sincronizzati</CTableHeaderCell>
                                                                <CTableHeaderCell>Errori</CTableHeaderCell>
                                                            </CTableRow>
                                                        </CTableHead>
                                                        <CTableBody>
                                                            {calendarLogs.slice(-10).map((log, index) => (
                                                                <CTableRow key={index}>
                                                                    <CTableDataCell>
                                                                        {new Date(log.timestamp).toLocaleString('it-IT')}
                                                                    </CTableDataCell>
                                                                    <CTableDataCell>
                                                                        <CBadge color="success">{log.total_synced || 0}</CBadge>
                                                                    </CTableDataCell>
                                                                    <CTableDataCell>
                                                                        <CBadge color="danger">{log.total_errors || 0}</CBadge>
                                                                    </CTableDataCell>
                                                                </CTableRow>
                                                            ))}
                                                        </CTableBody>
                                                    </CTable>
                                                ) : (
                                                    <CAlert color="info">Nessun log calendario disponibile</CAlert>
                                                )}
                                            </CCol>
                                        </CRow>
                                    </div>
                                </CTabPane>
                            </CTabContent>
                        </CCardBody>
                    </CCard>
                </CCol>
            </CRow>

            {/* Modal Settings */}
            <CModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)}>
                <CModalHeader>
                    <CModalTitle>
                        Configurazione {editingService === 'reminder' ? 'Promemoria' :
                            editingService === 'recall' ? 'Richiami' : 'Calendario'}
                    </CModalTitle>
                </CModalHeader>
                <CModalBody>
                    <CForm>
                        <div className="mb-3">
                            <CFormLabel>Stato</CFormLabel>
                            <CFormSelect
                                value={(tempSettings[`${editingService}_enabled` as keyof SchedulerSettings] ? 'true' : 'false') as string}
                                onChange={(e) => setTempSettings(prev => ({
                                    ...prev,
                                    [`${editingService}_enabled`]: e.target.value === 'true'
                                }))}
                            >
                                <option value="true">Attivo</option>
                                <option value="false">Disabilitato</option>
                            </CFormSelect>
                        </div>

                        <CRow>
                            <CCol md={6}>
                                <div className="mb-3">
                                    <CFormLabel>Ora</CFormLabel>
                                    <CFormInput
                                        type="number"
                                        min="0"
                                        max="23"
                                        value={(tempSettings[`${editingService}_hour` as keyof SchedulerSettings] as number) || 0}
                                        onChange={(e) => setTempSettings(prev => ({
                                            ...prev,
                                            [`${editingService}_hour`]: parseInt(e.target.value)
                                        }))}
                                    />
                                </div>
                            </CCol>
                            <CCol md={6}>
                                <div className="mb-3">
                                    <CFormLabel>Minuto</CFormLabel>
                                    <CFormInput
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={(tempSettings[`${editingService}_minute` as keyof SchedulerSettings] as number) || 0}
                                        onChange={(e) => setTempSettings(prev => ({
                                            ...prev,
                                            [`${editingService}_minute`]: parseInt(e.target.value)
                                        }))}
                                    />
                                </div>
                            </CCol>
                        </CRow>

                        {editingService === 'calendar' && (
                            <>
                                <div className="mb-3">
                                    <CFormLabel>ID Calendario Studio Blu</CFormLabel>
                                    <CFormInput
                                        type="text"
                                        value={tempSettings.calendar_studio_blu_id || ''}
                                        onChange={(e) => setTempSettings(prev => ({
                                            ...prev,
                                            calendar_studio_blu_id: e.target.value
                                        }))}
                                    />
                                </div>
                                <div className="mb-3">
                                    <CFormLabel>ID Calendario Studio Giallo</CFormLabel>
                                    <CFormInput
                                        type="text"
                                        value={tempSettings.calendar_studio_giallo_id || ''}
                                        onChange={(e) => setTempSettings(prev => ({
                                            ...prev,
                                            calendar_studio_giallo_id: e.target.value
                                        }))}
                                    />
                                </div>
                            </>
                        )}
                    </CForm>
                </CModalBody>
                <CModalFooter>
                    <CButton color="secondary" onClick={() => setShowSettingsModal(false)}>
                        Annulla
                    </CButton>
                    <CButton color="primary" onClick={handleSaveSettings} disabled={loading}>
                        {loading ? <CSpinner size="sm" className="me-1" /> : null}
                        Salva
                    </CButton>
                </CModalFooter>
            </CModal>
        </div>
    );
};

export default SchedulerPage;