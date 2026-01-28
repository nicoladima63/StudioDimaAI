
import React, { useState, useEffect } from 'react';
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CButton,
    CButtonGroup,
    CSpinner,
    CBadge,
    CProgressBar,
    CDropdown,
    CDropdownToggle,
    CDropdownMenu,
    CDropdownItem,
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CModalFooter,
    CFormLabel,
    CFormInput,
    CFormSelect
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilCheckCircle, cilOptions, cilTask } from '@coreui/icons';
import { worksService } from '../../services/works.service';
import { Task, CATEGORY_COLORS, CATEGORY_NAMES, Work } from '../../types/works.types';
import toast from 'react-hot-toast';
import PazientiSelect from '../../components/selects/PazientiSelect';
import { usePazienti } from '../../store/pazienti.store';
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal';

const TasksPage: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [worksMap, setWorksMap] = useState<Record<number, Work>>({}); // Cache works to know category
    const [worksList, setWorksList] = useState<Work[]>([]); // For select
    const [filterStatus, setFilterStatus] = useState<'active' | 'completed' | 'all'>('active');

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newTask, setNewTask] = useState<{
        patient_id: string;
        work_id: number | '';
        description: string;
        start_date: string;
        due_date: string;
    }>({
        patient_id: '',
        work_id: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        due_date: ''
    });

    const fetchTasks = async () => {
        setLoading(true);
        try {
            // Parallel fetch tasks and works (to get metadata/category info for tasks)
            const [tasksData, worksData] = await Promise.all([
                worksService.getAllTasks(),
                worksService.getAllWorks()
            ]);

            setTasks(tasksData);
            setWorksList(worksData);

            const wMap: Record<number, Work> = {};
            worksData.forEach(w => wMap[w.id] = w);
            setWorksMap(wMap);

        } catch (error) {
            console.error('Error fetching tasks:', error);
            toast.error('Errore nel caricamento dei tasks');
        } finally {
            setLoading(false);
        }
    };

    const { allPazienti, loadAll: loadPazienti } = usePazienti();

    useEffect(() => {
        fetchTasks();
        loadPazienti();
    }, []);

    const getTaskColor = (workId: number) => {
        const work = worksMap[workId];
        if (!work) return '#ccc';
        return CATEGORY_COLORS[work.category] || CATEGORY_COLORS['default'];
    };

    const getTaskCategoryName = (workId: number) => {
        const work = worksMap[workId];
        if (!work) return 'Unknown';
        return CATEGORY_NAMES[work.category] || 'Generale';
    };

    const calculateProgress = (task: Task) => {
        if (!task.steps || task.steps.length === 0) return 0;
        const completed = task.steps.filter(s => s.status === 'completed').length;
        return Math.round((completed / task.steps.length) * 100);
    };

    const handleOpenModal = () => {
        setNewTask({
            patient_id: '',
            work_id: '',
            description: '',
            start_date: new Date().toISOString().split('T')[0],
            due_date: ''
        });
        setModalVisible(true);
    };

    const handleCreateTask = async () => {
        if (!newTask.patient_id || !newTask.work_id) {
            toast.error('Seleziona un paziente e una lavorazione');
            return;
        }

        setIsSaving(true);
        try {
            await worksService.createTask({
                patient_id: newTask.patient_id,
                work_id: Number(newTask.work_id),
                description: newTask.description,
                start_date: newTask.start_date,
                due_date: newTask.due_date || ''
            });
            toast.success('Lavorazione creata con successo');
            setModalVisible(false);
            fetchTasks();
        } catch (error) {
            console.error('Error creating task:', error);
            toast.error('Errore durante la creazione della lavorazione');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCompleteStep = async (taskId: number, stepId: number) => {
        try {
            await worksService.completeStep(taskId, stepId);
            toast.success('Step completato!');
            fetchTasks();
        } catch (error) {
            console.error('Error completing step:', error);
            toast.error('Errore nel completamento dello step');
        }
    };

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const handleDeleteTask = (taskId: number) => {
        setItemToDelete(taskId);
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await worksService.deleteTask(itemToDelete);
            toast.success('Lavorazione eliminata');
            fetchTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            toast.error('Errore nell\'eliminazione');
            throw error; // Re-throw for modal to handle if needed, though modal swallows/displays error
        } finally {
            setDeleteModalVisible(false);
            setItemToDelete(null);
        }
    };

    const handleCancelTask = async (taskId: number) => {
        if (!window.confirm('Vuoi annullare questa lavorazione?')) return;
        try {
            await worksService.updateTaskStatus(taskId, 'cancelled');
            toast.success('Lavorazione annullata');
            fetchTasks();
        } catch (error) {
            console.error('Error cancelling task:', error);
            toast.error('Errore nell\'annullamento');
        }
    };

    const filteredTasks = tasks.filter(task => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'completed') return task.status === 'completed';
        if (filterStatus === 'active') return task.status !== 'completed' && task.status !== 'cancelled';
        return true;
    });

    return (
        <div className="p-2">
            <CRow className="mb-4">
                <CCol className="d-flex justify-content-between align-items-center">
                    <h3><CIcon icon={cilTask} className="me-2" /> Le mie Lavorazioni (Tasks)</h3>
                    <div className="d-flex gap-3">
                        <CButtonGroup role="group">
                            <CButton
                                color={filterStatus === 'active' ? 'primary' : 'outline-primary'}
                                onClick={() => setFilterStatus('active')}
                            >
                                In Corso
                            </CButton>
                            <CButton
                                color={filterStatus === 'completed' ? 'primary' : 'outline-primary'}
                                onClick={() => setFilterStatus('completed')}
                            >
                                Completati
                            </CButton>
                            <CButton
                                color={filterStatus === 'all' ? 'primary' : 'outline-primary'}
                                onClick={() => setFilterStatus('all')}
                            >
                                Tutti
                            </CButton>
                        </CButtonGroup>
                        <CButton color="primary" onClick={handleOpenModal}>
                            <CIcon icon={cilPlus} className="me-2" />
                            Nuova Lavorazione
                        </CButton>
                    </div>
                </CCol>
            </CRow>

            {loading ? (
                <div className="text-center">
                    <CSpinner color="primary" variant="grow" />
                </div>
            ) : (
                <CRow>
                    {filteredTasks.map((task) => {
                        const progress = calculateProgress(task);
                        const borderColor = getTaskColor(task.work_id);
                        const patientName = allPazienti.find((p: any) => p.id === task.patient_id)?.nome || task.patient_id;

                        // Calculate Phase info
                        const totalSteps = task.steps?.length || 0;
                        const activeStepIndex = task.steps?.findIndex(s => s.status === 'active') ?? -1;
                        const activeStep = task.steps?.[activeStepIndex];
                        const phaseLabel = activeStepIndex >= 0 ? `Fase ${activeStepIndex + 1} di ${totalSteps}` : (task.status === 'completed' ? 'Completato' : '-');

                        return (
                            <CCol xs={12} md={6} lg={4} xl={3} key={task.id} className="mb-4">
                                <CCard
                                    className="h-100 shadow-sm"
                                    style={{ borderTop: `6px solid ${borderColor}` }}
                                >
                                    <CCardHeader className="bg-transparent border-0 d-flex justify-content-between align-items-start pt-3">
                                        <div style={{ maxWidth: '85%' }}>
                                            <h5 className="mb-1 text-truncate" title={task.description}>
                                                {task.description || worksMap[task.work_id]?.name || 'Lavorazione'}
                                            </h5>
                                            <CBadge
                                                className="border me-2"
                                                style={{ backgroundColor: borderColor, color: '#fff' }}
                                            >
                                                {getTaskCategoryName(task.work_id)}
                                            </CBadge>
                                            <span className="text-muted fw-bold">{patientName}</span>
                                        </div>
                                        <CDropdown variant="btn-group">
                                            <CDropdownToggle color="transparent" size="sm" className="p-0 text-secondary" caret={false}>
                                                <CIcon icon={cilOptions} />
                                            </CDropdownToggle>
                                            <CDropdownMenu>
                                                <CDropdownItem href="#" onClick={() => toast('Dettagli non ancora disponibili', { icon: 'ℹ️' })}>Dettagli</CDropdownItem>
                                                <CDropdownItem href="#" className="text-warning" onClick={() => handleCancelTask(task.id)}>Annulla</CDropdownItem>
                                                <CDropdownItem href="#" className="text-danger" onClick={() => handleDeleteTask(task.id)}>Elimina</CDropdownItem>
                                            </CDropdownMenu>
                                        </CDropdown>
                                    </CCardHeader>
                                    <CCardBody>
                                        <div className="mb-2">
                                            <div className="d-flex justify-content-between mb-1">
                                                <small>{phaseLabel}</small>
                                                <small>{progress}%</small>
                                            </div>
                                            <CProgressBar value={progress} color={progress === 100 ? 'success' : 'info'} />
                                        </div>

                                        <div className="mt-3 small text-muted d-flex justify-content-between align-items-center">
                                            <div>Creato il: {new Date(task.created_at).toLocaleDateString()}</div>
                                            {task.due_date && (
                                                <div className="text-danger fw-bold">
                                                    Consegna: {new Date(task.due_date).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </CCardBody>

                                    <div className="p-3 border-top bg-light">
                                        {activeStep ? (
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div className="text-truncate me-2" style={{ maxWidth: '60%' }}>
                                                    <span className="small fw-bold text-dark">{activeStep.name}</span>
                                                </div>
                                                <CButton
                                                    size="sm"
                                                    color="success"
                                                    className="text-white"
                                                    onClick={() => handleCompleteStep(task.id, activeStep.id)}
                                                >
                                                    <CIcon icon={cilCheckCircle} className="me-1" /> Fatto
                                                </CButton>
                                            </div>
                                        ) : (
                                            <div className="text-center text-success">
                                                <CIcon icon={cilCheckCircle} /> Completato
                                            </div>
                                        )}
                                    </div>
                                </CCard>
                            </CCol>
                        );
                    })}

                    {tasks.length === 0 && (
                        <CCol xs={12}>
                            <div className="text-center p-5 bg-white border rounded">
                                <p className="text-muted mb-0">Nessuna lavorazione attiva.</p>
                                <CButton color="link" onClick={handleOpenModal}>Crea una nuova lavorazione</CButton>
                            </div>
                        </CCol>
                    )}
                </CRow>
            )}

            {/* CREATE TASK MODAL */}
            <CModal visible={modalVisible} onClose={() => !isSaving && setModalVisible(false)} size="lg">
                <CModalHeader>
                    <CModalTitle>Nuova Lavorazione (Task)</CModalTitle>
                </CModalHeader>
                <CModalBody>
                    <div className="mb-3">
                        <CFormLabel>Paziente</CFormLabel>
                        <PazientiSelect
                            value={newTask.patient_id}
                            onChange={(p) => setNewTask({ ...newTask, patient_id: p ? p.id : '' })}
                            placeholder="Cerca e seleziona un paziente..."
                            hideDetails={true}
                        />
                    </div>

                    <div className="mb-3">
                        <CFormLabel>Template Lavorazione</CFormLabel>
                        <CFormSelect
                            value={newTask.work_id}
                            onChange={(e) => {
                                const wid = Number(e.target.value);
                                const work = worksList.find(w => w.id === wid);
                                setNewTask({
                                    ...newTask,
                                    work_id: wid,
                                    description: work ? `${work.name} - ${new Date().toLocaleDateString()}` : newTask.description
                                });
                            }}
                        >
                            <option value="">-- Seleziona il tipo di lavoro --</option>
                            {worksList.map(work => (
                                <option key={work.id} value={work.id}>
                                    {work.name} ({CATEGORY_NAMES[work.category] || work.category})
                                </option>
                            ))}
                        </CFormSelect>
                    </div>

                    <div className="mb-3">
                        <CFormLabel>Descrizione</CFormLabel>
                        <CFormInput
                            type="text"
                            value={newTask.description}
                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                            placeholder="Descrizione opzionale (es. Protesi superiore)"
                        />
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <CFormLabel>Data Inizio</CFormLabel>
                            <CFormInput
                                type="date"
                                value={newTask.start_date}
                                onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                            />
                        </div>
                        <div className="col-md-6 mb-3">
                            <CFormLabel>Data Scadenza (Opzionale)</CFormLabel>
                            <CFormInput
                                type="date"
                                value={newTask.due_date}
                                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                            />
                        </div>
                    </div>
                </CModalBody>
                <CModalFooter>
                    <CButton color="secondary" onClick={() => setModalVisible(false)} disabled={isSaving}>
                        Annulla
                    </CButton>
                    <CButton color="primary" onClick={handleCreateTask} disabled={isSaving}>
                        {isSaving ? <CSpinner size="sm" /> : 'Crea Lavorazione'}
                    </CButton>
                </CModalFooter>
            </CModal>

            <ConfirmDeleteModal
                visible={deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={confirmDelete}
                title="Elimina Lavorazione"
                itemName={itemToDelete ? (tasks.find(t => t.id === itemToDelete)?.description || 'Lavorazione') : ''}
                itemType="lavorazione"
                warning="Questa operazione cancellerà tutti i dati relativi a questa lavorazione."
            />
        </div >
    );
};

export default TasksPage;
