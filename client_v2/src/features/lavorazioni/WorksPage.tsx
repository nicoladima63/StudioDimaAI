
import React, { useState, useEffect } from 'react';
import {
    CCard,
    CCardBody,
    CCardHeader,
    CCol,
    CRow,
    CTable,
    CTableBody,
    CTableHead,
    CTableHeaderCell,
    CTableRow,
    CTableDataCell,
    CButton,
    CSpinner,
    CBadge,
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CModalFooter,
    CForm,
    CFormInput,
    CFormSelect,
    CFormLabel,
    CFormTextarea
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPencil, cilTrash, cilList, cilChevronTop, cilChevronBottom } from '@coreui/icons';
import { Work, StepTemplate, Provider, CATEGORY_COLORS, CATEGORY_NAMES } from '../../types/works.types';
import toast from 'react-hot-toast';
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal';
import { useUserStore } from '../../store/user.store';
import { useWorkStore } from '../../store/works.store';
import { useProviderStore } from '../../store/provider.store';
import { worksService } from '../../services/works.service'; // Assuming worksService is still needed for getWork

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { WorkStepItem } from './WorkStepItem';

const WorksPage: React.FC = () => {
    // Stores
    const { works, loading: worksLoading, loadWorks, createWork, updateWork, deleteWork } = useWorkStore();
    const { providers, loadProviders } = useProviderStore();
    const { users, loadUsers } = useUserStore();

    const [modalVisible, setModalVisible] = useState(false);
    const [editingWork, setEditingWork] = useState<Partial<Work>>({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    // Steps handling inside modal
    const [tempSteps, setTempSteps] = useState<Partial<StepTemplate>[]>([]);
    // Maintain a parallel array of unique IDs for dragging if steps don't have IDs
    const [stepIds, setStepIds] = useState<string[]>([]);

    // Auto-focus logic for new steps
    const lastInputRef = React.useRef<HTMLInputElement | null>(null);
    const prevStepsLength = React.useRef(0);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        // Sync IDs with steps
        if (tempSteps.length > stepIds.length) {
            // Added
            const newIds = [...stepIds];
            for (let i = stepIds.length; i < tempSteps.length; i++) {
                newIds.push(`temp-${Date.now()}-${Math.random()}`);
            }
            setStepIds(newIds);
        } else if (tempSteps.length < stepIds.length) {
            // Removed - we handle this in removeStep usually, but for safety
            setStepIds(stepIds.slice(0, tempSteps.length));
        }
    }, [tempSteps.length]);


    useEffect(() => {
        if (tempSteps.length > prevStepsLength.current) {
            if (lastInputRef.current) {
                lastInputRef.current.focus();
            }
        }
        prevStepsLength.current = tempSteps.length;
    }, [tempSteps.length]);

    useEffect(() => {
        const init = async () => {
            await Promise.all([
                loadWorks(),
                loadProviders(),
                loadUsers()
            ]);
        };
        init();
    }, []);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setStepIds((ids) => {
                const oldIndex = ids.indexOf(active.id as string);
                const newIndex = ids.indexOf(over.id as string);
                return arrayMove(ids, oldIndex, newIndex);
            });

            setTempSteps((items) => {
                // We need to find indices via IDs to be safe
                const oldIndex = stepIds.indexOf(active.id as string);
                const newIndex = stepIds.indexOf(over.id as string);

                const newItems = arrayMove(items, oldIndex, newIndex);
                // Re-assign order index
                newItems.forEach((s, i) => s.order_index = i);
                return newItems;
            });
        }
    };

    const handleSave = async () => {
        try {
            const workToSave: Partial<Work> = {
                ...editingWork,
                steps: tempSteps as StepTemplate[] // Cast is safe as backend validates
            };

            if (isEditMode && editingWork.id) {
                await updateWork(editingWork.id, workToSave);
                toast.success('Template aggiornato');
            } else {
                await createWork(workToSave);
                toast.success('Template creato');
            }
            setModalVisible(false);
        } catch (error) {
            console.error('Error saving work:', error);
            toast.error('Errore nel salvataggio');
        }
    };


    const handleDelete = (id: number) => {
        setItemToDelete(id);
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteWork(itemToDelete);
            toast.success('Work eliminato');
        } catch (error) {
            console.error('Error deleting work:', error);
            toast.error('Errore durante l\'eliminazione');
        } finally {
            setDeleteModalVisible(false);
            setItemToDelete(null);
        }
    };

    const openModal = async (work?: Work) => {
        if (work) {
            try {
                const fullWork = await worksService.getWork(work.id);
                setEditingWork({ ...fullWork });
                const steps = fullWork.steps || [];
                setTempSteps(steps);
                // Initialize IDs for existing steps
                setStepIds(steps.map((s, i) => s.id ? `db-${s.id}` : `temp-${i}-${Date.now()}`));

                prevStepsLength.current = steps.length;
                setIsEditMode(true);
                setModalVisible(true);
            } catch (e) {
                toast.error("Errore recupero dettagli");
            }
        } else {
            setEditingWork({ category: '1' });
            setTempSteps([]);
            setStepIds([]);
            prevStepsLength.current = 0;
            setIsEditMode(false);
            setModalVisible(true);
        }
    };

    const addStep = () => {
        const newStep = { name: '', order_index: tempSteps.length };
        setTempSteps([...tempSteps, newStep]);
        // ID will be added by useEffect
    };

    const updateStep = (index: number, field: keyof StepTemplate, value: any) => {
        const newSteps = [...tempSteps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setTempSteps(newSteps);
    };

    const removeStep = (index: number) => {
        const newSteps = [...tempSteps];
        newSteps.splice(index, 1);
        newSteps.forEach((s, i) => s.order_index = i);
        setTempSteps(newSteps);

        const newIds = [...stepIds];
        newIds.splice(index, 1);
        setStepIds(newIds);
    };



    return (
        <CRow>
            <CCol xs={12}>
                <CCard className="mb-4">
                    <CCardHeader className="d-flex justify-content-between align-items-center">
                        <strong>
                            <CIcon icon={cilList} className="me-2" />
                            Gestione Lavorazioni
                        </strong>
                        <CButton color="primary" onClick={() => openModal()}>
                            <CIcon icon={cilPlus} className="me-2" />
                            Nuova Lavorazione
                        </CButton>
                    </CCardHeader>
                    <CCardBody>
                        {worksLoading === 'loading' ? (
                            <div className="text-center">
                                <CSpinner color="primary" />
                            </div>
                        ) : (
                            <CTable hover responsive>
                                <CTableHead>
                                    <CTableRow>
                                        <CTableHeaderCell>ID</CTableHeaderCell>
                                        <CTableHeaderCell>Nome</CTableHeaderCell>
                                        <CTableHeaderCell>Categoria</CTableHeaderCell>
                                        <CTableHeaderCell>Descrizione</CTableHeaderCell>
                                        <CTableHeaderCell>Fasi</CTableHeaderCell>
                                        <CTableHeaderCell>Azioni</CTableHeaderCell>
                                    </CTableRow>
                                </CTableHead>
                                <CTableBody>
                                    {works.map((work) => (
                                        <CTableRow key={work.id}>
                                            <CTableDataCell>{work.id}</CTableDataCell>
                                            <CTableDataCell><strong>{work.name}</strong></CTableDataCell>
                                            <CTableDataCell>
                                                <CBadge style={{ backgroundColor: CATEGORY_COLORS[work.category] || '#ccc', padding: '10px', color: 'black', width: '120px' }}>
                                                    {CATEGORY_NAMES[work.category] || work.category}
                                                </CBadge>
                                            </CTableDataCell>
                                            <CTableDataCell>{work.description || '-'}</CTableDataCell>
                                            <CTableDataCell>
                                                {work.steps ? work.steps.length : 0}
                                            </CTableDataCell>
                                            <CTableDataCell>
                                                <CButton color="info" variant="ghost" size="sm" onClick={() => openModal(work)}>
                                                    <CIcon icon={cilPencil} />
                                                </CButton>
                                                <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(work.id)}>
                                                    <CIcon icon={cilTrash} />
                                                </CButton>
                                            </CTableDataCell>
                                        </CTableRow>
                                    ))}
                                    {works.length === 0 && (
                                        <CTableRow>
                                            <CTableDataCell colSpan={6} className="text-center">Nessun work template trovato</CTableDataCell>
                                        </CTableRow>
                                    )}
                                </CTableBody>
                            </CTable>
                        )}
                    </CCardBody>
                </CCard>
            </CCol>

            {/* Modal */}
            <CModal visible={modalVisible} onClose={() => setModalVisible(false)} size="lg">
                <CModalHeader>
                    <CModalTitle>{isEditMode ? 'Modifica Work Template' : 'Nuovo Work Template'}</CModalTitle>
                </CModalHeader>
                <CModalBody>
                    <CForm>
                        <CRow>
                            <CCol md={4}>
                                <div className="mb-3">
                                    <CFormLabel>Nome Lavorazione</CFormLabel>
                                    <CFormInput
                                        type="text"
                                        value={editingWork.name || ''}
                                        onChange={(e) => setEditingWork({ ...editingWork, name: e.target.value })}
                                        placeholder="Es. Impianto + Corona"
                                    />
                                </div>
                            </CCol>
                            <CCol md={4}>
                                <div className="mb-3">
                                    <CFormLabel>Categoria</CFormLabel>
                                    <CFormSelect
                                        value={editingWork.category || '1'}
                                        onChange={(e) => setEditingWork({ ...editingWork, category: e.target.value })}
                                    >
                                        {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                                            <option key={key} value={key}>{name}</option>
                                        ))}
                                    </CFormSelect>
                                </div>
                            </CCol>
                            <CCol md={4}>
                                <div className="mb-3">
                                    <CFormLabel>Provider Default</CFormLabel>
                                    <CFormSelect
                                        value={editingWork.provider_id || ''}
                                        onChange={(e) => setEditingWork({ ...editingWork, provider_id: e.target.value })}
                                    >
                                        <option value="">-- Seleziona --</option>
                                        {providers.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                                        ))}
                                    </CFormSelect>
                                </div>
                            </CCol>
                        </CRow>

                        <div className="mb-3">
                            <CFormLabel>Descrizione</CFormLabel>
                            <CFormTextarea
                                rows={2}
                                value={editingWork.description || ''}
                                onChange={(e) => setEditingWork({ ...editingWork, description: e.target.value })}
                            />
                        </div>

                        <hr />
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5>Steps ({tempSteps.length})</h5>
                            <CButton color="success" size="sm" onClick={addStep} variant="outline">
                                <CIcon icon={cilPlus} /> Aggiungi Step
                            </CButton>
                        </div>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={tempSteps.map((_, i) => `step-${i}`)}
                                strategy={verticalListSortingStrategy}
                            >
                                {tempSteps.map((step, idx) => (
                                    <WorkStepItem
                                        key={`step-${idx}-${step.order_index}`} // Use stable key if possible, but index based key + order is tricky with temp items.
                                        // Actually dnd-kit recommends stable IDs.
                                        // Since new steps don't have IDs, we need to generate temporary IDs or use index carefully.
                                        // BUT index changes on reorder. 
                                        // So we need a stable "local ID" for each step in tempSteps.
                                        // I'll update addStep to ensure steps have a client-side ID.
                                        id={stepIds[idx] || `step-${idx}`}
                                        step={step}
                                        index={idx}
                                        users={users}
                                        updateStep={updateStep}
                                        removeStep={removeStep}
                                        lastInputRef={lastInputRef}
                                        totalSteps={tempSteps.length}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                    </CForm>
                </CModalBody>
                <CModalFooter>
                    <CButton color="secondary" onClick={() => setModalVisible(false)}>
                        Annulla
                    </CButton>
                    <CButton color="primary" onClick={handleSave}>
                        Salva Template
                    </CButton>
                </CModalFooter>
            </CModal>

            <ConfirmDeleteModal
                visible={deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={confirmDelete}
                title="Elimina Template"
                itemName={itemToDelete ? (works.find(w => w.id === itemToDelete)?.name || 'Template') : ''}
                itemType="template lavorazione"
                warning="Questa operazione cancellerà il template e non sarà più utilizzabile per nuove lavorazioni."
            />
        </CRow>
    );
};

export default WorksPage;
