import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormInput,
  CFormTextarea,
  CFormSelect,
  CBadge,
  CListGroup,
  CListGroupItem,
  CInputGroup,
  CInputGroupText,
  CAlert,
  CProgress,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilPlus,
  cilTrash,
  cilCheckCircle,
  cilCircle,
  cilPencil,
  cilSearch,
  cilFilter,
  cilX,
  cilTag,
  cilCalendar,
  cilChart,
} from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';

const STORAGE_KEY = 'eisenhower_matrix_data';

interface Task {
  id: string;
  title: string;
  description?: string;
  quadrant: number;
  tags?: string[];
  dueDate?: string;
  color?: string;
  completed: boolean;
  createdAt: string;
}

interface QuadrantInfo {
  title: string;
  subtitle: string;
  color: string;
  icon: string;
}

const EisenhowerMatrix: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quadrant: 1,
    tags: '',
    dueDate: '',
    color: '',
  });

  const quadrants: Record<number, QuadrantInfo> = {
    1: { title: 'Urgente e Importante', subtitle: 'Fare subito', color: 'danger', icon: '🔥' },
    2: {
      title: 'Non Urgente ma Importante',
      subtitle: 'Pianificare',
      color: 'success',
      icon: '📅',
    },
    3: { title: 'Urgente ma Non Importante', subtitle: 'Delegare', color: 'warning', icon: '👥' },
    4: {
      title: 'Non Urgente e Non Importante',
      subtitle: 'Eliminare',
      color: 'secondary',
      icon: '🗑️',
    },
  };

  const colorOptions = [
    { value: '', label: 'Default' },
    { value: 'primary', label: 'Blu' },
    { value: 'info', label: 'Azzurro' },
    { value: 'warning', label: 'Giallo' },
    { value: 'danger', label: 'Rosso' },
    { value: 'success', label: 'Verde' },
    { value: 'dark', label: 'Scuro' },
  ];

  // Carica i task dal localStorage
  useEffect(() => {
    loadTasks();
  }, []);

  // Salva i task nel localStorage ogni volta che cambiano
  useEffect(() => {
    if (tasks.length > 0 || localStorage.getItem(STORAGE_KEY)) {
      saveTasks();
    }
  }, [tasks]);

  const loadTasks = (): void => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTasks(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Errore nel caricamento dei task:', error);
    }
  };

  const saveTasks = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error('Errore nel salvataggio dei task:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();

    const taskData = {
      ...formData,
      tags: formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t),
    };

    if (editingTask) {
      setTasks(tasks.map(t => (t.id === editingTask.id ? { ...t, ...taskData } : t)));
    } else {
      const newTask: Task = {
        ...taskData,
        id: Date.now().toString(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setTasks([...tasks, newTask]);
    }

    handleCloseModal();
  };

  const handleDelete = (taskId: string): void => {
    if (!window.confirm('Sei sicuro di voler eliminare questo task?')) return;
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleToggleComplete = (task: Task): void => {
    setTasks(tasks.map(t => (t.id === task.id ? { ...t, completed: !t.completed } : t)));
  };

  const handleOpenModal = (task: Task | null = null): void => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || '',
        quadrant: task.quadrant,
        tags: (task.tags || []).join(', '),
        dueDate: task.dueDate || '',
        color: task.color || '',
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        quadrant: 1,
        tags: '',
        dueDate: '',
        color: '',
      });
    }
    setModalVisible(true);
  };

  const handleCloseModal = (): void => {
    setModalVisible(false);
    setEditingTask(null);
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, task: Task): void => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetQuadrant: number): void => {
    e.preventDefault();
    if (draggedTask && draggedTask.quadrant !== targetQuadrant) {
      setTasks(tasks.map(t => (t.id === draggedTask.id ? { ...t, quadrant: targetQuadrant } : t)));
    }
    setDraggedTask(null);
  };

  // Filtri
  const getFilteredTasks = (quadrant: number): Task[] => {
    return tasks.filter(t => {
      const matchesQuadrant = t.quadrant === quadrant;
      const matchesSearch =
        !searchTerm ||
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = !filterTag || (t.tags || []).includes(filterTag);

      return matchesQuadrant && matchesSearch && matchesTag;
    });
  };

  // Estrai tutti i tag unici
  const getAllTags = (): string[] => {
    const tags = new Set<string>();
    tasks.forEach(t => {
      (t.tags || []).forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  };

  // Calcola statistiche
  const getStats = (): {
    total: number;
    completed: number;
    byQuadrant: { quadrant: number; count: number; completed: number }[];
    overdue: number;
  } => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const byQuadrant = [1, 2, 3, 4].map(q => ({
      quadrant: q,
      count: tasks.filter(t => t.quadrant === q).length,
      completed: tasks.filter(t => t.quadrant === q && t.completed).length,
    }));

    const overdue = tasks.filter(t => {
      if (!t.dueDate || t.completed) return false;
      return new Date(t.dueDate) < new Date();
    }).length;

    return { total, completed, byQuadrant, overdue };
  };

  const stats = getStats();
  const allTags = getAllTags();

  // Controlla se un task è scaduto
  const isOverdue = (task: Task): boolean => {
    if (!task.dueDate || task.completed) return false;
    return new Date(task.dueDate) < new Date();
  };

  // Giorni rimanenti
  const getDaysRemaining = (dueDate?: string): number | null => {
    if (!dueDate) return null;
    const days = Math.ceil(
      (new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  return (
    <>
      <PageLayout>
        <PageLayout.Header
          title='Matrice di Eisenhower'
          headerAction={
            <CButton color='primary' onClick={() => handleOpenModal()}>
              <CIcon icon={cilPlus} className='me-2' />
              Nuovo Task
            </CButton>
          }
        />
        <PageLayout.ContentHeader>
          <CRow>
            <CCol md={6}>
              <h5 className='mb-3'>Filtri e Ricerca</h5>
              <CCol md={6}>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilTag} />
                  </CInputGroupText>
                  <CFormSelect value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                    <option value=''>Tutti i tag</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </CFormSelect>
                  {filterTag && (
                    <CButton color='secondary' variant='outline' onClick={() => setFilterTag('')}>
                      <CIcon icon={cilX} />
                    </CButton>
                  )}
                </CInputGroup>
              </CCol>
              <CCol md={6}>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilSearch} />
                  </CInputGroupText>
                  <CFormInput
                    placeholder='Cerca task...'
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <CButton color='secondary' variant='outline' onClick={() => setSearchTerm('')}>
                      <CIcon icon={cilX} />
                    </CButton>
                  )}
                </CInputGroup>
              </CCol>
            </CCol>
            <CCol md={6}>
              <h5 className='mb-3'>Statistiche</h5>
              <div className='row g-2'>
                <div className='col-12'>
                  <div className='d-flex justify-content-between'>
                    <CRow>
                      <CCol>
                        <CAlert color='info' className='d-flex flex-wrap gap-3 align-items-center'>
                          <div>
                            <strong>Totale:</strong> {stats.total} task
                          </div>
                          <div>
                            <strong>Completati:</strong> {stats.completed} (
                            {stats.total > 0
                              ? Math.round((stats.completed / stats.total) * 100)
                              : 0}
                            %)
                          </div>
                          {stats.overdue > 0 && (
                            <div className='text-danger'>
                              <strong>⚠️ Scaduti:</strong> {stats.overdue}
                            </div>
                          )}
                          <div className='flex-grow-1'>
                            <CProgress className='mt-1'>
                              <CProgress
                                color='success'
                                value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}
                              />
                            </CProgress>
                          </div>
                        </CAlert>
                      </CCol>
                    </CRow>
                  </div>
                </div>
              </div>
            </CCol>
          </CRow>
        </PageLayout.ContentHeader>

        <PageLayout.ContentBody>
          {/* Matrice */}
          <CRow>
            {[1, 2, 3, 4].map(quadrant => (
              <CCol md={6} key={quadrant} className='mb-4'>
                <CCard
                  className={`border-${quadrants[quadrant].color} h-100`}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, quadrant)}
                  style={{
                    minHeight: '300px',
                    transition: 'all 0.3s ease',
                    opacity: draggedTask && draggedTask.quadrant !== quadrant ? 0.95 : 1,
                  }}
                >
                  <CCardHeader className={`bg-${quadrants[quadrant].color} text-white`}>
                    <div className='d-flex justify-content-between align-items-center'>
                      <div>
                        <strong>
                          {quadrants[quadrant].icon} {quadrants[quadrant].title}
                        </strong>
                        <div className='small'>{quadrants[quadrant].subtitle}</div>
                      </div>
                      <CBadge color='light' className='text-dark'>
                        {getFilteredTasks(quadrant).length}
                      </CBadge>
                    </div>
                  </CCardHeader>
                  <CCardBody>
                    <CListGroup flush>
                      {getFilteredTasks(quadrant).length === 0 ? (
                        <div className='text-center text-muted py-4'>
                          {searchTerm || filterTag
                            ? 'Nessun task corrispondente'
                            : 'Trascina qui i task o creane di nuovi'}
                        </div>
                      ) : (
                        getFilteredTasks(quadrant).map(task => (
                          <CListGroupItem
                            key={task.id}
                            draggable
                            onDragStart={e => handleDragStart(e, task)}
                            className={`d-flex justify-content-between align-items-start ${
                              task.color ? `border-start border-${task.color} border-3` : ''
                            }`}
                            style={{
                              cursor: 'grab',
                              opacity: task.completed ? 0.6 : 1,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div className='flex-grow-1'>
                              <div className='d-flex align-items-start'>
                                <CIcon
                                  icon={task.completed ? cilCheckCircle : cilCircle}
                                  className={`me-2 mt-1 ${task.completed ? 'text-success' : 'text-muted'}`}
                                  style={{ cursor: 'pointer', flexShrink: 0 }}
                                  onClick={() => handleToggleComplete(task)}
                                />
                                <div className='flex-grow-1'>
                                  <div
                                    className={
                                      task.completed
                                        ? 'text-decoration-line-through text-muted'
                                        : ''
                                    }
                                  >
                                    <strong>{task.title}</strong>
                                    {task.description && (
                                      <div className='small text-muted mt-1'>
                                        {task.description}
                                      </div>
                                    )}
                                  </div>

                                  {/* Tags */}
                                  {task.tags && task.tags.length > 0 && (
                                    <div className='mt-2'>
                                      {task.tags.map(tag => (
                                        <CBadge
                                          key={tag}
                                          color='info'
                                          className='me-1'
                                          style={{ fontSize: '0.7rem' }}
                                        >
                                          {tag}
                                        </CBadge>
                                      ))}
                                    </div>
                                  )}

                                  {/* Data di scadenza */}
                                  {task.dueDate && (
                                    <div
                                      className={`small mt-2 ${isOverdue(task) ? 'text-danger fw-bold' : 'text-muted'}`}
                                    >
                                      <CIcon icon={cilCalendar} size='sm' className='me-1' />
                                      {new Date(task.dueDate).toLocaleDateString('it-IT')}
                                      {!task.completed &&
                                        (() => {
                                          const days = getDaysRemaining(task.dueDate);
                                          if (days === null) return '';
                                          if (days < 0) return ' - SCADUTO';
                                          if (days === 0) return ' - OGGI';
                                          if (days === 1) return ' - Domani';
                                          if (days <= 7) return ` - ${days} giorni`;
                                          return '';
                                        })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className='d-flex gap-1 ms-2'>
                              <CButton
                                color='primary'
                                variant='ghost'
                                size='sm'
                                onClick={() => handleOpenModal(task)}
                              >
                                <CIcon icon={cilPencil} />
                              </CButton>
                              <CButton
                                color='danger'
                                variant='ghost'
                                size='sm'
                                onClick={() => handleDelete(task.id)}
                              >
                                <CIcon icon={cilTrash} />
                              </CButton>
                            </div>
                          </CListGroupItem>
                        ))
                      )}
                    </CListGroup>
                  </CCardBody>
                </CCard>
              </CCol>
            ))}
          </CRow>
        </PageLayout.ContentBody>
      </PageLayout>
      {/* Modal */}
      <CModal visible={modalVisible} onClose={handleCloseModal} size='lg'>
        <CModalHeader>
          <CModalTitle>{editingTask ? '✏️ Modifica Task' : '➕ Nuovo Task'}</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleSubmit}>
          <CModalBody>
            <div className='mb-3'>
              <CFormInput
                label='Titolo *'
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder='Es: Completare presentazione'
              />
            </div>

            <div className='mb-3'>
              <CFormTextarea
                label='Descrizione'
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder='Dettagli aggiuntivi...'
              />
            </div>

            <CRow>
              <CCol md={6}>
                <div className='mb-3'>
                  <CFormSelect
                    label='Quadrante *'
                    value={formData.quadrant}
                    onChange={e => setFormData({ ...formData, quadrant: parseInt(e.target.value) })}
                  >
                    {Object.entries(quadrants).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.icon} {value.title}
                      </option>
                    ))}
                  </CFormSelect>
                </div>
              </CCol>

              <CCol md={6}>
                <div className='mb-3'>
                  <CFormSelect
                    label='Colore'
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                  >
                    {colorOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </CFormSelect>
                </div>
              </CCol>
            </CRow>

            <div className='mb-3'>
              <CFormInput
                type='date'
                label='Data di scadenza'
                value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className='mb-3'>
              <CFormInput
                label='Tag'
                value={formData.tags}
                onChange={e => setFormData({ ...formData, tags: e.target.value })}
                placeholder='Es: lavoro, urgente, team (separati da virgola)'
              />
              <small className='text-muted'>Separa i tag con virgole</small>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' onClick={handleCloseModal}>
              Annulla
            </CButton>
            <CButton color='primary' type='submit'>
              {editingTask ? '💾 Salva' : '➕ Crea'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  );
};

export default EisenhowerMatrix;
