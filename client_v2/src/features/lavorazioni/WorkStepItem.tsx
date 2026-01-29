
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    CCard,
    CCardBody,
    CRow,
    CCol,
    CFormLabel,
    CFormInput,
    CFormSelect,
    CButton,
    CBadge
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTrash, cilHamburgerMenu } from '@coreui/icons';
import { StepTemplate } from '../../types/works.types';

interface WorkStepItemProps {
    id: string; // Unique ID for DnD
    step: Partial<StepTemplate>;
    index: number;
    users: any[];
    updateStep: (index: number, field: keyof StepTemplate, value: any) => void;
    removeStep: (index: number) => void;
    lastInputRef: React.MutableRefObject<HTMLInputElement | null>;
    totalSteps: number;
}

export const WorkStepItem: React.FC<WorkStepItemProps> = ({
    id,
    step,
    index,
    users,
    updateStep,
    removeStep,
    lastInputRef,
    totalSteps
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'default', // Default cursor, handle has move cursor
        zIndex: isDragging ? 1000 : 'auto',
        position: 'relative' as 'relative', // Explicitly cast to valid Position
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-2">
            <CCard className="border-secondary">
                <CCardBody className="p-2">
                    <CRow className="align-items-center">
                        {/* Drag Handle & Index */}
                        <CCol xs={2} className="d-flex align-items-center justify-content-center">
                            <div className="d-flex align-items-center">
                                <div
                                    {...attributes}
                                    {...listeners}
                                    style={{ cursor: 'grab', padding: '5px' }}
                                    className="d-flex align-items-center text-secondary"
                                >
                                    <CIcon icon={cilHamburgerMenu} size="lg" />
                                </div>
                                <CBadge color="secondary" className="me-2" style={{ minWidth: '25px' }}>{index + 1}</CBadge>
                            </div>
                        </CCol>

                        {/* Name */}
                        <CCol md={4} sm={4}>
                            <CFormLabel className="mb-0 text-muted" style={{ fontSize: '0.65rem' }}>Nome Step</CFormLabel>
                            <CFormInput
                                ref={index === totalSteps - 1 ? lastInputRef : null}
                                size="sm"
                                placeholder="Nome Step (es. Presa impronta)"
                                value={step.name || ''}
                                onChange={(e) => updateStep(index, 'name', e.target.value)}
                            />
                        </CCol>

                        {/* Description */}
                        <CCol md={3} sm={3}>
                            <CFormLabel className="mb-0 text-muted" style={{ fontSize: '0.65rem' }}>Descrizione</CFormLabel>
                            <CFormInput
                                size="sm"
                                className="mb-1"
                                placeholder="opzionale"
                                value={step.description || ''}
                                onChange={(e) => updateStep(index, 'description', e.target.value)}
                            />
                        </CCol>

                        {/* Executor */}
                        <CCol md={2} sm={2}>
                            <CFormLabel className="mb-0 text-muted" style={{ fontSize: '0.65rem' }}>Esecutore</CFormLabel>
                            <CFormSelect
                                size="sm"
                                value={step.user_id || ''}
                                onChange={(e) => updateStep(index, 'user_id', e.target.value)}
                            >
                                <option value="">Seleziona</option>
                                {users.filter((u: any) => u.role !== 'admin').map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.username}</option>
                                ))}
                            </CFormSelect>
                        </CCol>

                        {/* Delete */}
                        <CCol xs={1} className="text-end">
                            <CFormLabel className="mb-0 text-muted" style={{ fontSize: '0.65rem' }}>Elimina</CFormLabel>
                            <CButton color="danger" variant="ghost" size="sm" onClick={() => removeStep(index)}>
                                <CIcon icon={cilTrash} />
                            </CButton>
                        </CCol>
                    </CRow>
                </CCardBody>
            </CCard>
        </div>
    );
};
