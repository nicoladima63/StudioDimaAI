import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CButton,
    CSpinner,
    CBadge,
    CListGroup,
    CListGroupItem,
    CContainer
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilArrowLeft, cilCheckCircle, cilTask, cilUser } from '@coreui/icons';
import { worksService } from '../../services/works.service';
import { Task } from '../../types/works.types';
import toast from 'react-hot-toast';
import { useUserStore } from '../../store/user.store';
import { usePazienti } from '@/store/pazienti.store';
import { useAuthStore } from '../../store/auth.store';

const WorkDetailsPage: React.FC = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(false);
    const { allPazienti, loadAll: loadPazienti } = usePazienti();
    const { users, loadUsers } = useUserStore();
    const { user: currentUser } = useAuthStore();

    useEffect(() => {
        if (taskId) {
            loadTaskAndPatients(parseInt(taskId, 10));
            loadUsers();
        }
    }, [taskId]);

    const loadTaskAndPatients = async (id: number) => {
        setLoading(true);
        try {
            const taskData = await worksService.getTask(id);
            setTask(taskData);
            await loadPazienti();
        } catch (error) {
            console.error("Error loading task details:", error);
            toast.error("Errore nel caricamento del dettaglio lavorazione");
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteStep = async (stepId: number) => {
        // ... same impl
        if (!task) return;
        try {
            await worksService.completeStep(task.id, stepId);
            toast.success("Fase completata!");
            // Reload task to get updated status
            loadTaskAndPatients(task.id);
        } catch (error) {
            console.error("Error completing step:", error);
            toast.error("Errore nel completamento della fase");
        }
    };

    const getPatientName = (patientId: string) => {
        const p = allPazienti.find((px: any) => px.id === patientId);
        return p ? p.nome : patientId;
    };

    const getUserName = (userId?: string | number) => {
        if (!userId) return null;
        const u = users.find(user => user.id.toString() === userId.toString());
        return u ? u.username : userId;
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
                <CSpinner color="primary" />
            </div>
        );
    }

    if (!task) {
        return (
            <CContainer>
                <div className="alert alert-warning">Lavorazione non trovata.</div>
                <CButton color="secondary" onClick={() => navigate(-1)}>Torna indietro</CButton>
            </CContainer>
        );
    }

    return (
        <CContainer fluid>
            <div className="mb-4">
                <CButton color="link" className="px-0 text-decoration-none" onClick={() => navigate(-1)}>
                    <CIcon icon={cilArrowLeft} className="me-2" />
                    Torna indietro
                </CButton>
            </div>

            <CRow>
                {/* Header Card */}
                <CCol xs={12} className="mb-4">
                    <CCard className="shadow-sm border-top-primary border-top-3">
                        <CCardBody>
                            <CRow className="align-items-center">
                                <CCol md={5}>
                                    <h2 className="mb-1">
                                        {getPatientName(task.patient_id)}, {' '}
                                        {task.description}
                                    </h2>
                                </CCol>
                                <CCol md={4} className="text-center text-muted small">
                                    Creato il: {new Date(task.created_at).toLocaleDateString()}
                                    {task.due_date && <div>Scadenza: {new Date(task.due_date).toLocaleDateString()}</div>}
                                </CCol>
                                <CCol md={3}>
                                    <CBadge color={task.status === 'completed' ? 'success' : 'info'} shape="rounded" className="p-3">
                                        {task.status === 'completed' ? 'Completato' : 'In Corso'}
                                    </CBadge>
                                </CCol>
                            </CRow>
                        </CCardBody>
                    </CCard>
                </CCol>

                {/* Steps Timeline/List */}
                <CCol xs={12}>
                    <CCard className="mb-4">
                        <CCardHeader>
                            <h5 className="mb-0"><CIcon icon={cilTask} className="me-2" />Fasi Lavorazione</h5>
                        </CCardHeader>
                        <CCardBody>
                            <CListGroup flush>
                                {task.steps?.sort((a, b) => a.order_index - b.order_index).map((step, index) => {
                                    const isActive = step.status === 'active';
                                    const isCompleted = step.status === 'completed';
                                    const isPending = step.status === 'pending';

                                    return (
                                        <CListGroupItem
                                            key={step.id}
                                            className={`d-flex justify-content-between align-items-center p-3 ${isActive ? 'bg-light border-start border-primary border-4' : ''}`}
                                        >
                                            <div className="d-flex align-items-center">
                                                <div className={`me-3 d-flex justify-content-center align-items-center rounded-circle ${isCompleted ? 'bg-success text-white' : (isActive ? 'bg-primary text-white' : 'bg-secondary text-white')}`} style={{ width: '32px', height: '32px' }}>
                                                    {isCompleted ? <CIcon icon={cilCheckCircle} /> : <span>{index + 1}</span>}
                                                </div>
                                                <div>
                                                    <h6 className={`mb-0 ${isCompleted ? 'text-decoration-line-through text-muted' : ''}`}>{step.name}</h6>
                                                    {step.description && <small className="text-muted">{step.description}</small>}
                                                    {step.user_id && <div className="small text-info">Utente assegnato: {getUserName(step.user_id)}</div>}
                                                </div>
                                            </div>

                                            <div>
                                                {isActive && step.user_id && currentUser && step.user_id.toString() === currentUser.id.toString() && (
                                                    <CButton
                                                        color="success"
                                                        className="text-white"
                                                        onClick={() => handleCompleteStep(step.id)}
                                                    >
                                                        <CIcon icon={cilCheckCircle} className="me-2" />
                                                        Fatto
                                                    </CButton>
                                                )}
                                                {isActive && (!step.user_id || !currentUser || step.user_id.toString() !== currentUser.id.toString()) && (
                                                    <span className="text-muted small">Assegnato a: {getUserName(step.user_id)}</span>
                                                )}
                                                {isCompleted && (
                                                    <span className="text-success small fw-bold">Completato il {new Date(step.updated_at).toLocaleDateString()}</span>
                                                )}
                                                {isPending && <span className="text-muted small">In attesa</span>}
                                            </div>

                                        </CListGroupItem>
                                    );
                                })}
                            </CListGroup>
                        </CCardBody>
                    </CCard>
                </CCol>
            </CRow>
        </CContainer>
    );
};

export default WorkDetailsPage;
