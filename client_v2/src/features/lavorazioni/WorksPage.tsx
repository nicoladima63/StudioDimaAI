
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
import { cilPlus, cilPencil, cilTrash, cilList } from '@coreui/icons';
import { Work, StepTemplate, Provider, CATEGORY_COLORS, CATEGORY_NAMES } from '../../types/works.types';
import toast from 'react-hot-toast';
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal';
import { useUserStore } from '../../store/user.store';
import { useWorkStore } from '../../store/works.store';
import { useProviderStore } from '../../store/provider.store';
import { worksService } from '../../services/works.service'; // Assuming worksService is still needed for getWork

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
            // Fetch full details including steps if needed, or use what we have if list includes them
            // API getWork usually returns steps.
            try {
                const fullWork = await worksService.getWork(work.id);
                setEditingWork({ ...fullWork });
                setTempSteps(fullWork.steps || []);
                setIsEditMode(true);
                setModalVisible(true);
            } catch (e) {
                toast.error("Errore recupero dettagli");
            }
        } else {
            setEditingWork({ category: '1' }); // Default category
            setTempSteps([]);
            setIsEditMode(false);
            setModalVisible(true);
        }
    };

    const addStep = () => {
        setTempSteps([...tempSteps, { name: 'Nuovo Step', order_index: tempSteps.length }]);
    };

    const updateStep = (index: number, field: keyof StepTemplate, value: any) => {
        const newSteps = [...tempSteps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setTempSteps(newSteps);
    };

    const removeStep = (index: number) => {
        const newSteps = [...tempSteps];
        newSteps.splice(index, 1);
        // Re-index?
        setTempSteps(newSteps);
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

                        {tempSteps.map((step, idx) => (
                            <CCard key={idx} className="mb-2 border-secondary">
                                <CCardBody className="p-2">
                                    <CRow className="align-items-center">
                                        <CCol xs={1}>


                                            <CBadge color="dark">{idx + 1}</CBadge>
                                        </CCol>
                                        <CCol md={4}>
                                            <CFormLabel className="mb-0 text-muted" style={{ fontSize: '0.65rem' }}>Nome Step</CFormLabel>
                                            <CFormInput
                                                size="sm"
                                                placeholder="Nome Step (es. Presa impronta)"
                                                value={step.name || ''}
                                                onChange={(e) => updateStep(idx, 'name', e.target.value)}
                                            />
                                        </CCol>
                                        <CCol md={2}>
                                            <CFormLabel className="mb-0 text-muted" style={{ fontSize: '0.65rem' }}>Descrizione</CFormLabel>
                                            <CFormInput
                                                size="sm"
                                                className="mb-1"
                                                placeholder="opzionale"
                                                value={step.description || ''}
                                                onChange={(e) => updateStep(idx, 'description', e.target.value)}
                                            />
                                        </CCol>
                                        <CCol md={4}>
                                            <CFormLabel className="mb-0 text-muted" style={{ fontSize: '0.65rem' }}>Esecutore</CFormLabel>
                                            <CFormSelect
                                                size="sm"
                                                value={step.provider_id || ''} // We reuse provider_id field to store user ID for steps
                                                onChange={(e) => updateStep(idx, 'provider_id', e.target.value)}
                                            >
                                                <option value="">-- Seleziona un valore --</option>
                                                {users.filter(u => u.role !== 'admin').map((u) => (
                                                    <option key={u.id} value={u.id}>{u.username}</option>
                                                ))}
                                            </CFormSelect>
                                        </CCol>
                                        <CCol xs={1} className="text-end">
                                            <CButton color="danger" variant="ghost" size="sm" onClick={() => removeStep(idx)}>
                                                <CIcon icon={cilTrash} />
                                            </CButton>
                                        </CCol>
                                    </CRow>
                                </CCardBody>
                            </CCard>
                        ))}

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
