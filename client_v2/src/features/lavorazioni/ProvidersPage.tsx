
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
    CFormLabel
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPencil, cilTrash, cilPeople } from '@coreui/icons';
import { Provider } from '../../types/works.types';
import toast from 'react-hot-toast';
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal';
import { useProviderStore } from '../../store/provider.store';

const ProvidersPage: React.FC = () => {
    const { providers, loading, loadProviders, createProvider, updateProvider, deleteProvider } = useProviderStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProvider, setEditingProvider] = useState<Partial<Provider>>({});
    const [isEditMode, setIsEditMode] = useState(false);

    useEffect(() => {
        loadProviders();
    }, []);

    const handleSave = async () => {
        try {
            if (isEditMode && editingProvider.id) {
                await updateProvider(editingProvider.id, editingProvider);
                toast.success('Provider aggiornato');
            } else {
                await createProvider(editingProvider);
                toast.success('Provider creato');
            }
            setModalVisible(false);
        } catch (error) {
            console.error('Error saving provider:', error);
            toast.error('Errore nel salvataggio');
        }
    };

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const handleDelete = (id: number) => {
        setItemToDelete(id);
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteProvider(itemToDelete);
            toast.success('Provider eliminato');
        } catch (error) {
            console.error('Error deleting provider:', error);
            toast.error('Errore durante l\'eliminazione');
        } finally {
            setDeleteModalVisible(false);
            setItemToDelete(null);
        }
    };

    const openModal = (provider?: Provider) => {
        if (provider) {
            setEditingProvider({ ...provider });
            setIsEditMode(true);
        } else {
            setEditingProvider({ type: 'lab' }); // Default type
            setIsEditMode(false);
        }
        setModalVisible(true);
    };

    return (
        <CRow>
            <CCol xs={12}>
                <CCard className="mb-4">
                    <CCardHeader className="d-flex justify-content-between align-items-center">
                        <strong>
                            <CIcon icon={cilPeople} className="me-2" />
                            Gestione Providers
                        </strong>
                        <CButton color="primary" onClick={() => openModal()}>
                            <CIcon icon={cilPlus} className="me-2" />
                            Nuovo Provider
                        </CButton>
                    </CCardHeader>
                    <CCardBody>
                        {loading ? (
                            <div className="text-center">
                                <CSpinner color="primary" />
                            </div>
                        ) : (
                            <CTable hover responsive>
                                <CTableHead>
                                    <CTableRow>
                                        <CTableHeaderCell>ID</CTableHeaderCell>
                                        <CTableHeaderCell>Nome</CTableHeaderCell>
                                        <CTableHeaderCell>Tipo</CTableHeaderCell>
                                        <CTableHeaderCell>Email</CTableHeaderCell>
                                        <CTableHeaderCell>Telefono</CTableHeaderCell>
                                        <CTableHeaderCell>Azioni</CTableHeaderCell>
                                    </CTableRow>
                                </CTableHead>
                                <CTableBody>
                                    {providers.map((provider) => (
                                        <CTableRow key={provider.id}>
                                            <CTableDataCell>{provider.id}</CTableDataCell>
                                            <CTableDataCell><strong>{provider.name}</strong></CTableDataCell>
                                            <CTableDataCell>
                                                <CBadge color={provider.type === 'internal' ? 'info' : provider.type === 'lab' ? 'warning' : 'secondary'}>
                                                    {provider.type}
                                                </CBadge>
                                            </CTableDataCell>
                                            <CTableDataCell>{provider.email || '-'}</CTableDataCell>
                                            <CTableDataCell>{provider.phone || '-'}</CTableDataCell>
                                            <CTableDataCell>
                                                <CButton color="info" variant="ghost" size="sm" onClick={() => openModal(provider)}>
                                                    <CIcon icon={cilPencil} />
                                                </CButton>
                                                <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(provider.id)}>
                                                    <CIcon icon={cilTrash} />
                                                </CButton>
                                            </CTableDataCell>
                                        </CTableRow>
                                    ))}
                                    {providers.length === 0 && (
                                        <CTableRow>
                                            <CTableDataCell colSpan={6} className="text-center">Nessun provider trovato</CTableDataCell>
                                        </CTableRow>
                                    )}
                                </CTableBody>
                            </CTable>
                        )}
                    </CCardBody>
                </CCard>
            </CCol>

            {/* Modal */}
            <CModal visible={modalVisible} onClose={() => setModalVisible(false)}>
                <CModalHeader>
                    <CModalTitle>{isEditMode ? 'Modifica Provider' : 'Nuovo Provider'}</CModalTitle>
                </CModalHeader>
                <CModalBody>
                    <CForm>
                        <div className="mb-3">
                            <CFormLabel>Nome</CFormLabel>
                            <CFormInput
                                type="text"
                                value={editingProvider.name || ''}
                                onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                                placeholder="Nome del laboratorio o fornitore"
                            />
                        </div>
                        <div className="mb-3">
                            <CFormLabel>Tipo</CFormLabel>
                            <CFormSelect
                                value={editingProvider.type || 'lab'}
                                onChange={(e) => setEditingProvider({ ...editingProvider, type: e.target.value as any })}
                            >
                                <option value="lab">Laboratorio</option>
                                <option value="external">Esterno</option>
                                <option value="internal">Interno</option>
                            </CFormSelect>
                        </div>
                        <div className="mb-3">
                            <CFormLabel>Email</CFormLabel>
                            <CFormInput
                                type="email"
                                value={editingProvider.email || ''}
                                onChange={(e) => setEditingProvider({ ...editingProvider, email: e.target.value })}
                            />
                        </div>
                        <div className="mb-3">
                            <CFormLabel>Telefono</CFormLabel>
                            <CFormInput
                                type="text"
                                value={editingProvider.phone || ''}
                                onChange={(e) => setEditingProvider({ ...editingProvider, phone: e.target.value })}
                            />
                        </div>
                    </CForm>
                </CModalBody>
                <CModalFooter>
                    <CButton color="secondary" onClick={() => setModalVisible(false)}>
                        Annulla
                    </CButton>
                    <CButton color="primary" onClick={handleSave}>
                        Salva
                    </CButton>
                </CModalFooter>
            </CModal>

            <ConfirmDeleteModal
                visible={deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={confirmDelete}
                title="Elimina Provider"
                itemName={itemToDelete ? (providers.find(p => p.id === itemToDelete)?.name || 'Provider') : ''}
                itemType="fornitore"
                warning="Questa operazione è irreversibile."
            />
        </CRow >
    );
};

export default ProvidersPage;
