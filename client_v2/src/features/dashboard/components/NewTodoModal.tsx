import React, { useState, useEffect } from 'react';
import {
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CModalFooter,
    CButton,
    CForm,
    CFormInput,
    CFormTextarea,
    CFormSelect,
    CFormLabel,
    CSpinner,
    CRow,
    CCol,
} from '@coreui/react';
import { useAuthStore } from '@/store/auth.store';
import { todoService } from '@/services/api/todos';
import { userService } from '@/services/api/user.service';
import type { User } from '@/types';
import toast from 'react-hot-toast';

interface NewTodoModalProps {
    visible: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const NewTodoModal: React.FC<NewTodoModalProps> = ({ visible, onClose, onCreated }) => {
    const { user } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        recipient_id: '',
        subject: '',
        message: '',
        priority: 'medium',
        due_date: '',
    });

    useEffect(() => {
        if (visible) {
            loadUsers();
            // Reset form
            setFormData({
                recipient_id: '',
                subject: '',
                message: '',
                priority: 'medium',
                due_date: '',
            });
        }
    }, [visible]);

    const loadUsers = async () => {
        setLoadingUsers(true);
        try {
            const response = await userService.apiGetAllUsers();
            if (response.success && response.data) {
                setUsers(response.data);
            }
        } catch (error) {
            toast.error('Errore nel caricamento utenti');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent double submit
        if (saving) return;

        if (!formData.recipient_id) {
            toast.error('Seleziona un destinatario');
            return;
        }
        if (!formData.subject.trim()) {
            toast.error('Inserisci un oggetto');
            return;
        }

        setSaving(true);
        try {
            const response = await todoService.create({
                sender_id: user!.id,
                recipient_id: Number(formData.recipient_id),
                subject: formData.subject.trim(),
                message: formData.message.trim() || undefined,
                priority: formData.priority,
                due_date: formData.due_date || undefined,
                type: 'general',
            });

            if (response.success) {
                toast.success('Todo creato con successo');
                onCreated();
                onClose();
            } else {
                toast.error('Errore nella creazione del todo');
            }
        } catch (error) {
            toast.error('Errore nella creazione del todo');
        } finally {
            setSaving(false);
        }
    };

    return (
        <CModal visible={visible} onClose={onClose} size="lg">
            <CModalHeader>
                <CModalTitle>Nuovo Todo</CModalTitle>
            </CModalHeader>
            <CForm onSubmit={handleSubmit}>
                <CModalBody>
                    <CRow className="mb-3">
                        <CCol md={6}>
                            <CFormLabel>Destinatario *</CFormLabel>
                            {loadingUsers ? (
                                <CSpinner size="sm" />
                            ) : (
                                <CFormSelect
                                    value={formData.recipient_id}
                                    onChange={e => handleChange('recipient_id', e.target.value)}
                                    required
                                >
                                    <option value="">Seleziona destinatario...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.username}
                                        </option>
                                    ))}
                                </CFormSelect>
                            )}
                        </CCol>
                        <CCol md={6}>
                            <CFormLabel>Priorita</CFormLabel>
                            <CFormSelect
                                value={formData.priority}
                                onChange={e => handleChange('priority', e.target.value)}
                            >
                                <option value="low">Bassa</option>
                                <option value="medium">Media</option>
                                <option value="high">Alta</option>
                                <option value="urgent">Urgente</option>
                            </CFormSelect>
                        </CCol>
                    </CRow>

                    <CRow className="mb-3">
                        <CCol md={12}>
                            <CFormLabel>Oggetto *</CFormLabel>
                            <CFormInput
                                value={formData.subject}
                                onChange={e => handleChange('subject', e.target.value)}
                                placeholder="Inserisci oggetto del todo..."
                                required
                            />
                        </CCol>
                    </CRow>

                    <CRow className="mb-3">
                        <CCol md={12}>
                            <CFormLabel>Messaggio</CFormLabel>
                            <CFormTextarea
                                value={formData.message}
                                onChange={e => handleChange('message', e.target.value)}
                                placeholder="Descrizione opzionale..."
                                rows={3}
                            />
                        </CCol>
                    </CRow>

                    <CRow className="mb-3">
                        <CCol md={6}>
                            <CFormLabel>Scadenza</CFormLabel>
                            <CFormInput
                                type="date"
                                value={formData.due_date}
                                onChange={e => handleChange('due_date', e.target.value)}
                            />
                        </CCol>
                    </CRow>
                </CModalBody>
                <CModalFooter>
                    <CButton color="secondary" variant="outline" onClick={onClose} disabled={saving}>
                        Annulla
                    </CButton>
                    <CButton color="primary" type="submit" disabled={saving}>
                        {saving ? <CSpinner size="sm" /> : 'Crea Todo'}
                    </CButton>
                </CModalFooter>
            </CForm>
        </CModal>
    );
};

export default NewTodoModal;
