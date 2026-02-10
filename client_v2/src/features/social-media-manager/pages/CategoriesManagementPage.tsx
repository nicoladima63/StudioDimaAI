/**
 * CategoriesManagementPage - CRUD per categorie contenuti
 * Gestione completa con tabella, filtri, paginazione e modal
 */

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
  CSpinner,
  CFormInput,
  CRow,
  CCol,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormLabel,
  CFormTextarea
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilTrash, cilPlus, cilReload, cilColorBorder } from '@coreui/icons';
import * as icons from '@coreui/icons';
import { useSocialMediaStore } from '@/store/socialMedia.store';
import toast from 'react-hot-toast';
import type { Category } from '../types';
import IconPicker from '../components/IconPicker';

const CategoriesManagementPage: React.FC = () => {
  const {
    categories,
    isLoadingCategories,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory
  } = useSocialMediaStore();

  const [showModal, setShowModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3498db',
    icon: '',
    sort_order: 0
  });

  useEffect(() => {
    loadCategories();
  }, []);

  // Filtra categorie per ricerca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCategories(categories);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredCategories(
        categories.filter(
          (cat) =>
            cat.name.toLowerCase().includes(term) ||
            cat.description?.toLowerCase().includes(term)
        )
      );
    }
  }, [categories, searchTerm]);

  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      color: '#3498db',
      icon: '',
      sort_order: 0
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3498db',
      icon: category.icon || '',
      sort_order: category.sort_order || 0
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      color: '#3498db',
      icon: '',
      sort_order: 0
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validazione
    if (!formData.name.trim()) {
      toast.error('Il nome della categoria è obbligatorio');
      return;
    }

    setIsSaving(true);

    try {
      if (editingCategory) {
        // Update
        await updateCategory(editingCategory.id, formData);
        toast.success('Categoria aggiornata con successo');
      } else {
        // Create
        await createCategory(formData);
        toast.success('Categoria creata con successo');
      }

      handleCloseModal();
      loadCategories();
    } catch (error: any) {
      toast.error(error.message || 'Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!window.confirm(`Sei sicuro di voler eliminare la categoria "${category.name}"?`)) {
      return;
    }

    try {
      await deleteCategory(category.id);
      toast.success('Categoria eliminata con successo');
      loadCategories();
    } catch (error: any) {
      toast.error(error.message || "Errore durante l'eliminazione");
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIconSelect = (iconName: string) => {
    setFormData((prev) => ({
      ...prev,
      icon: iconName
    }));
  };

  // Ottieni l'icona da visualizzare
  const getIconComponent = (iconName?: string) => {
    if (!iconName) return null;
    const iconData = (icons as any)[iconName];
    return iconData ? <CIcon icon={iconData} size="lg" /> : null;
  };

  return (
    <div className="categories-management-page">
      <CRow className="mb-3">
        <CCol>
          <h2 className="mb-0">Gestione Categorie</h2>
          <p className="text-muted mb-0">
            Crea e gestisci le categorie per i contenuti dei post
          </p>
        </CCol>
      </CRow>

      <CCard>
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol md={6}>
              <strong>Categorie Contenuti</strong>
            </CCol>
            <CCol md={6} className="text-end">
              <CButton color="primary" onClick={handleOpenCreateModal}>
                <CIcon icon={cilPlus} className="me-2" />
                Nuova Categoria
              </CButton>
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody>
          {/* Barra ricerca */}
          <CRow className="mb-3">
            <CCol md={6}>
              <CFormInput
                type="text"
                placeholder="Cerca categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </CCol>
            <CCol md={6} className="text-end">
              <CButton
                color="secondary"
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  loadCategories();
                }}
                title="Ricarica"
              >
                <CIcon icon={cilReload} />
              </CButton>
            </CCol>
          </CRow>

          {/* Tabella */}
          {isLoadingCategories ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
              <p className="mt-2 text-muted">Caricamento categorie...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p>Nessuna categoria trovata</p>
              <small>Crea la tua prima categoria per iniziare!</small>
            </div>
          ) : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '50px' }}>Colore</CTableHeaderCell>
                  <CTableHeaderCell>Nome</CTableHeaderCell>
                  <CTableHeaderCell>Descrizione</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '100px' }}>Ordine</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '150px' }} className="text-end">
                    Azioni
                  </CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filteredCategories.map((category) => (
                  <CTableRow key={category.id}>
                    <CTableDataCell>
                      <CBadge
                        style={{
                          backgroundColor: category.color || '#6c757d',
                          color: '#fff',
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}
                      >
                        {' '}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex align-items-center gap-2">
                        {category.icon && getIconComponent(category.icon)}
                        <strong>{category.name}</strong>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <span className="text-muted">
                        {category.description || '-'}
                      </span>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="info">{category.sort_order || 0}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <div className="d-flex gap-1 justify-content-end">
                        <CButton
                          size="sm"
                          color="primary"
                          variant="ghost"
                          onClick={() => handleOpenEditModal(category)}
                          title="Modifica"
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                        <CButton
                          size="sm"
                          color="danger"
                          variant="ghost"
                          onClick={() => handleDelete(category)}
                          title="Elimina"
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* Modal Create/Edit */}
      <CModal visible={showModal} onClose={handleCloseModal} size="lg">
        <CModalHeader>
          <CModalTitle>
            {editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
          </CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSubmit}>
          <CModalBody>
            <CRow className="mb-3">
              <CCol md={8}>
                <CFormLabel htmlFor="name">
                  Nome Categoria <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="es: Promozione servizi"
                  required
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel htmlFor="sort_order">Ordine</CFormLabel>
                <CFormInput
                  type="number"
                  id="sort_order"
                  value={formData.sort_order}
                  onChange={(e) => handleInputChange('sort_order', Number(e.target.value))}
                  min={0}
                />
              </CCol>
            </CRow>

            <div className="mb-3">
              <CFormLabel htmlFor="description">Descrizione</CFormLabel>
              <CFormTextarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descrizione categoria (opzionale)"
              />
            </div>

            <CRow className="mb-3">
              <CCol md={6}>
                <CFormLabel htmlFor="color">Colore</CFormLabel>
                <div className="d-flex gap-2">
                  <CFormInput
                    type="color"
                    id="color"
                    value={formData.color}
                    onChange={(e) => handleInputChange('color', e.target.value)}
                    style={{ width: '60px' }}
                  />
                  <CFormInput
                    type="text"
                    value={formData.color}
                    onChange={(e) => handleInputChange('color', e.target.value)}
                    placeholder="#3498db"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
                <small className="text-muted">
                  Codice colore esadecimale (es: #3498db)
                </small>
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor="icon">Icona (opzionale)</CFormLabel>
                <div className="d-flex gap-2">
                  <CFormInput
                    type="text"
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => handleInputChange('icon', e.target.value)}
                    placeholder="es: cilStar"
                    readOnly
                  />
                  <CButton
                    color="primary"
                    variant="outline"
                    onClick={() => setShowIconPicker(true)}
                    title="Seleziona icona"
                  >
                    <CIcon icon={cilColorBorder} />
                  </CButton>
                </div>
                <small className="text-muted">
                  {formData.icon ? (
                    <span className="d-flex align-items-center gap-2 mt-1">
                      {getIconComponent(formData.icon)}
                      <span>{formData.icon}</span>
                    </span>
                  ) : (
                    'Clicca il pulsante per scegliere un\'icona'
                  )}
                </small>
              </CCol>
            </CRow>

            {/* Preview Badge */}
            <div className="mb-3">
              <CFormLabel>Anteprima</CFormLabel>
              <div>
                <CBadge
                  style={{
                    backgroundColor: formData.color,
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: '14px'
                  }}
                  className="d-inline-flex align-items-center gap-2"
                >
                  {formData.icon && getIconComponent(formData.icon)}
                  <span>{formData.name || 'Nome categoria'}</span>
                </CBadge>
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={handleCloseModal} disabled={isSaving}>
              Annulla
            </CButton>
            <CButton color="primary" type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Salvataggio...
                </>
              ) : editingCategory ? (
                'Aggiorna Categoria'
              ) : (
                'Crea Categoria'
              )}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* Icon Picker Modal */}
      <IconPicker
        visible={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={handleIconSelect}
        selectedIcon={formData.icon}
      />
    </div>
  );
};

export default CategoriesManagementPage;
