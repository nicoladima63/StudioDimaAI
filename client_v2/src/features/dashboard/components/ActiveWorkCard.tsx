import React, { useEffect, useState } from 'react';
import {
    CCard,
    CCardBody,
    CCardHeader,
    CTable,
    CTableHead,
    CTableRow,
    CTableHeaderCell,
    CTableBody,
    CTableDataCell,
    CBadge,
    CButton,
    CSpinner
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTask, cilArrowRight } from '@coreui/icons';
import { useNavigate } from 'react-router-dom';
import { worksService } from '../../../services/works.service';
import { Task, Work } from '../../../types/works.types';
import { usePazienti } from '../../../store/pazienti.store';

const ActiveWorkCard: React.FC = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [worksMap, setWorksMap] = useState<Record<number, Work>>({});
    const [loading, setLoading] = useState(false);
    const { allPazienti, loadAll: loadPazienti } = usePazienti();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allTasks, allWorks] = await Promise.all([
                worksService.getAllTasks(),
                worksService.getAllWorks()
            ]);

            // Filter for active tasks only
            const activeTasks = allTasks.filter((t: Task) => t.status !== 'completed' && t.status !== 'cancelled');

            // Sort by creation date desc
            activeTasks.sort((a: Task, b: Task) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setTasks(activeTasks);

            const wMap: Record<number, Work> = {};
            allWorks.forEach((w: Work) => wMap[w.id] = w);
            setWorksMap(wMap);

            await loadPazienti(); // Ensure patients are loaded
        } catch (e) {
            console.error("Failed to load active works", e);
        } finally {
            setLoading(false);
        }
    };

    const getPatientName = (patientId: string) => {
        const p = allPazienti.find((px: any) => px.id === patientId);
        return p ? p.nome : patientId;
    };

    const getPhaseLabel = (task: Task) => {
        if (!task.steps || task.steps.length === 0) return '-';
        const activeStepIndex = task.steps.findIndex((s: any) => s.status === 'active');
        if (activeStepIndex === -1) return 'In attesa';
        return `Fase ${activeStepIndex + 1}/${task.steps.length}`;
    };

    return (
        <CCard className="mb-4 h-100">
            <CCardHeader>
                <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                        <CIcon icon={cilTask} className="me-2" />
                        Lavorazioni Attive
                    </h5>
                    <CBadge color="primary" shape="rounded-pill">{tasks.length}</CBadge>
                </div>
            </CCardHeader>
            <CCardBody className="p-0">
                {loading ? (
                    <div className="text-center p-4">
                        <CSpinner size="sm" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center p-4 text-muted">
                        Nessuna lavorazione attiva
                    </div>
                ) : (
                    <CTable hover responsive className="mb-0 align-middle">
                        <CTableHead color="light">
                            <CTableRow>
                                <CTableHeaderCell>Paziente</CTableHeaderCell>
                                <CTableHeaderCell>Lavoro</CTableHeaderCell>
                                <CTableHeaderCell>Fase</CTableHeaderCell>
                                <CTableHeaderCell></CTableHeaderCell>
                            </CTableRow>
                        </CTableHead>
                        <CTableBody>
                            {tasks.slice(0, 5).map(task => { // Show max 5 items
                                const work = worksMap[task.work_id];

                                return (
                                    <CTableRow
                                        key={task.id}
                                        onClick={() => navigate(`/works/${task.id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <CTableDataCell>
                                            <div className="fw-bold text-truncate" style={{ maxWidth: '120px' }} title={getPatientName(task.patient_id)}>
                                                {getPatientName(task.patient_id)}
                                            </div>
                                        </CTableDataCell>
                                        <CTableDataCell>
                                            <div className="d-flex flex-column">
                                                <span className="text-truncate" style={{ maxWidth: '150px' }} title={work?.name}>{work?.name || 'Unknown'}</span>
                                                <small className="text-muted" style={{ fontSize: '0.7em' }}>{task.description}</small>
                                            </div>
                                        </CTableDataCell>
                                        <CTableDataCell>
                                            <CBadge color="info" shape="rounded-pill">{getPhaseLabel(task)}</CBadge>
                                        </CTableDataCell>
                                        <CTableDataCell className="text-end">
                                            <CIcon icon={cilArrowRight} size="sm" className="text-muted" />
                                        </CTableDataCell>
                                    </CTableRow>
                                );
                            })}
                        </CTableBody>
                    </CTable>
                )}
            </CCardBody>
            {tasks.length > 5 && (
                <div className="p-2 text-center border-top">
                    <CButton color="link" size="sm" onClick={() => navigate('/tasks')}>Vedi tutte ({tasks.length})</CButton>
                </div>
            )}
        </CCard>
    );
};

export default ActiveWorkCard;
