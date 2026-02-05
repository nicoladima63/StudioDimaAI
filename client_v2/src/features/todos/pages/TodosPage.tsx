import React, { useState, useEffect, useCallback } from 'react';
import {
    CCard,
    CCardBody,
    CCardHeader,
    CButton,
    CTable,
    CTableHead,
    CTableRow,
    CTableHeaderCell,
    CTableBody,
    CTableDataCell,
    CSpinner,
    CBadge,
    CFormSelect,
    CFormInput,
    CRow,
    CCol,
    CPagination,
    CPaginationItem,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheckCircle, cilClock, cilPencil, cilTrash, cilPlus, cilFilter } from '@coreui/icons';
import { useAuthStore } from '@/store/auth.store';
import { todoService } from '@/services/api/todos';
import type { Todo } from '@/services/api/todos';
import { userService } from '@/services/api/user.service';
import type { User } from '@/types';
import TodoModal from '@/features/dashboard/components/TodoModal';
import toast from 'react-hot-toast';

const TodosPage: React.FC = () => {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [todos, setTodos] = useState<Todo[]>([]);
    const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [userFilter, setUserFilter] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

    // Actions
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    useEffect(() => {
        loadTodos();
        if (isAdmin) {
            loadUsers();
        }
    }, [user, isAdmin]);

    useEffect(() => {
        applyFilters();
    }, [todos, statusFilter, priorityFilter, userFilter, searchText]);

    const loadTodos = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            let response;
            if (isAdmin) {
                // Admin vede tutti i todos
                response = await todoService.getAll(undefined, {
                    status: statusFilter || undefined,
                    priority: priorityFilter || undefined,
                    mode: 'all',
                });
            } else {
                // User normale vede solo i suoi
                response = await todoService.getInbox(user.id);
            }
            if (response.success && response.data) {
                setTodos(response.data);
            }
        } catch (error) {
            toast.error('Errore nel caricamento todos');
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await userService.apiGetAllUsers();
            if (response.success && response.data) {
                setUsers(response.data);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    const applyFilters = useCallback(() => {
        let result = [...todos];

        // Status filter (già applicato nel backend per admin)
        if (statusFilter && !isAdmin) {
            result = result.filter(t => t.status === statusFilter);
        }

        // Priority filter
        if (priorityFilter) {
            result = result.filter(t => t.priority === priorityFilter);
        }

        // User filter (solo admin)
        if (isAdmin && userFilter) {
            result = result.filter(t =>
                t.sender_id === Number(userFilter) || t.recipient_id === Number(userFilter)
            );
        }

        // Search text
        if (searchText) {
            const search = searchText.toLowerCase();
            result = result.filter(t =>
                t.subject.toLowerCase().includes(search) ||
                (t.message && t.message.toLowerCase().includes(search))
            );
        }

        setFilteredTodos(result);
        setCurrentPage(1);
    }, [todos, statusFilter, priorityFilter, userFilter, searchText, isAdmin]);

    const handleComplete = async (todoId: number) => {
        setActionLoading(todoId);
        try {
            const response = await todoService.complete(todoId, user!.id);
            if (response.success) {
                toast.success('Todo completato');
                loadTodos();
            }
        } catch (error) {
            toast.error('Errore nel completamento');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSnooze = async (todoId: number) => {
        setActionLoading(todoId);
        try {
            const response = await todoService.snooze(todoId, user!.id, 1);
            if (response.success) {
                toast.success('Todo posticipato di 1 giorno');
                loadTodos();
            }
        } catch (error) {
            toast.error('Errore nel posticipo');
        } finally {
            setActionLoading(null);
        }
    };

    const handleArchive = async (todoId: number) => {
        if (!confirm('Vuoi archiviare questo todo?')) return;
        setActionLoading(todoId);
        try {
            const response = await todoService.archive(todoId, user!.id);
            if (response.success) {
                toast.success('Todo archiviato');
                loadTodos();
            }
        } catch (error) {
            toast.error('Errore nell\'archiviazione');
        } finally {
            setActionLoading(null);
        }
    };

    const getEffectiveUrgency = (todo: Todo): string => {
        if (todo.urgency_level === 'lowered') return 'normal';
        if (todo.urgency_level && todo.urgency_level !== 'normal') {
            return todo.urgency_level;
        }
        switch (todo.priority) {
            case 'urgent': return 'critical';
            case 'high': return 'urgent';
            case 'medium': return 'attention';
            default: return 'normal';
        }
    };

    const getUrgencyBadge = (todo: Todo) => {
        const urgency = getEffectiveUrgency(todo);
        const colors: Record<string, string> = {
            critical: 'danger',
            urgent: 'warning',
            attention: 'info',
            normal: 'secondary',
        };
        const labels: Record<string, string> = {
            critical: 'CRITICO',
            urgent: 'URGENTE',
            attention: 'ATTENZIONE',
            normal: 'NORMALE',
        };
        return <CBadge color={colors[urgency]}>{labels[urgency]}</CBadge>;
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            pending: 'warning',
            read: 'info',
            completed: 'success',
            archived: 'secondary',
        };
        const labels: Record<string, string> = {
            pending: 'In attesa',
            read: 'Letto',
            completed: 'Completato',
            archived: 'Archiviato',
        };
        return <CBadge color={colors[status]}>{labels[status]}</CBadge>;
    };

    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    };

    const getUserName = (userId: number) => {
        const u = users.find(u => u.id === userId);
        return u ? u.username : `User ${userId}`;
    };

    // Pagination
    const totalPages = Math.ceil(filteredTodos.length / itemsPerPage);
    const paginatedTodos = filteredTodos.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const PaginationComponent = () => (
        <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
                <span>Mostra</span>
                <CFormSelect
                    size="sm"
                    style={{ width: '80px' }}
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </CFormSelect>
                <span>elementi</span>
                <span className="ms-3 text-muted">
                    Totale: {filteredTodos.length} todos
                </span>
            </div>
            {totalPages > 1 && (
                <CPagination size="sm">
                    <CPaginationItem
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(1)}
                    >
                        &laquo;
                    </CPaginationItem>
                    <CPaginationItem
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                    >
                        &lt;
                    </CPaginationItem>
                    <CPaginationItem active>{currentPage} / {totalPages}</CPaginationItem>
                    <CPaginationItem
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                    >
                        &gt;
                    </CPaginationItem>
                    <CPaginationItem
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                    >
                        &raquo;
                    </CPaginationItem>
                </CPagination>
            )}
        </div>
    );

    return (
        <div className="container-fluid">
            <CCard>
                <CCardHeader className="d-flex justify-content-between align-items-center">
                    <strong>Gestione Todo</strong>
                    <CButton
                        color="success"
                        size="sm"
                        onClick={() => { setEditingTodo(null); setShowModal(true); }}
                    >
                        <CIcon icon={cilPlus} className="me-1" />
                        Nuovo Todo
                    </CButton>
                </CCardHeader>
                <CCardBody>
                    {/* Filtri */}
                    <CRow className="mb-3 g-2">
                        <CCol md={2}>
                            <CFormSelect
                                size="sm"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            >
                                <option value="">Tutti gli stati</option>
                                <option value="pending">In attesa</option>
                                <option value="read">Letti</option>
                                <option value="completed">Completati</option>
                                <option value="archived">Archiviati</option>
                            </CFormSelect>
                        </CCol>
                        <CCol md={2}>
                            <CFormSelect
                                size="sm"
                                value={priorityFilter}
                                onChange={e => setPriorityFilter(e.target.value)}
                            >
                                <option value="">Tutte le priorita</option>
                                <option value="urgent">Urgente</option>
                                <option value="high">Alta</option>
                                <option value="medium">Media</option>
                                <option value="low">Bassa</option>
                            </CFormSelect>
                        </CCol>
                        {isAdmin && (
                            <CCol md={2}>
                                <CFormSelect
                                    size="sm"
                                    value={userFilter}
                                    onChange={e => setUserFilter(e.target.value)}
                                >
                                    <option value="">Tutti gli utenti</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.username}</option>
                                    ))}
                                </CFormSelect>
                            </CCol>
                        )}
                        <CCol md={isAdmin ? 4 : 6}>
                            <CFormInput
                                size="sm"
                                placeholder="Cerca per titolo o descrizione..."
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                            />
                        </CCol>
                        <CCol md={2}>
                            <CButton
                                color="secondary"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setStatusFilter('pending');
                                    setPriorityFilter('');
                                    setUserFilter('');
                                    setSearchText('');
                                }}
                            >
                                <CIcon icon={cilFilter} className="me-1" />
                                Reset
                            </CButton>
                        </CCol>
                    </CRow>

                    {/* Paginazione sopra */}
                    <div className="mb-2">
                        <PaginationComponent />
                    </div>

                    {/* Tabella */}
                    {loading ? (
                        <div className="text-center py-5">
                            <CSpinner color="primary" />
                        </div>
                    ) : paginatedTodos.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            Nessun todo trovato
                        </div>
                    ) : (
                        <CTable hover responsive striped>
                            <CTableHead>
                                <CTableRow>
                                    <CTableHeaderCell style={{ width: '100px' }}>Urgenza</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '100px' }}>Stato</CTableHeaderCell>
                                    <CTableHeaderCell>Titolo</CTableHeaderCell>
                                    {isAdmin && <CTableHeaderCell style={{ width: '120px' }}>Destinatario</CTableHeaderCell>}
                                    <CTableHeaderCell style={{ width: '100px' }}>Scadenza</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '180px' }}>Azioni</CTableHeaderCell>
                                </CTableRow>
                            </CTableHead>
                            <CTableBody>
                                {paginatedTodos.map(todo => (
                                    <CTableRow key={todo.id}>
                                        <CTableDataCell>{getUrgencyBadge(todo)}</CTableDataCell>
                                        <CTableDataCell>{getStatusBadge(todo.status)}</CTableDataCell>
                                        <CTableDataCell>
                                            <strong>{todo.subject}</strong>
                                            {todo.message && (
                                                <div className="text-muted small">{todo.message.substring(0, 50)}{todo.message.length > 50 ? '...' : ''}</div>
                                            )}
                                        </CTableDataCell>
                                        {isAdmin && (
                                            <CTableDataCell>{getUserName(todo.recipient_id)}</CTableDataCell>
                                        )}
                                        <CTableDataCell>{formatDate(todo.due_date)}</CTableDataCell>
                                        <CTableDataCell>
                                            <div className="d-flex gap-1">
                                                {user?.id === todo.recipient_id && (
                                                    <>
                                                        {todo.status !== 'completed' && todo.status !== 'archived' && (
                                                            <>
                                                                <CButton
                                                                    color="success"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    title="Completa"
                                                                    onClick={() => handleComplete(todo.id)}
                                                                    disabled={actionLoading === todo.id}
                                                                >
                                                                    {actionLoading === todo.id ? <CSpinner size="sm" /> : <CIcon icon={cilCheckCircle} />}
                                                                </CButton>
                                                                <CButton
                                                                    color="info"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    title="+1 giorno"
                                                                    onClick={() => handleSnooze(todo.id)}
                                                                    disabled={actionLoading === todo.id}
                                                                >
                                                                    <CIcon icon={cilClock} />
                                                                </CButton>
                                                                <CButton
                                                                    color="primary"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    title="Modifica"
                                                                    onClick={() => { setEditingTodo(todo); setShowModal(true); }}
                                                                >
                                                                    <CIcon icon={cilPencil} />
                                                                </CButton>
                                                            </>
                                                        )}
                                                        {todo.status !== 'archived' && (
                                                            <CButton
                                                                color="danger"
                                                                size="sm"
                                                                variant="ghost"
                                                                title="Archivia"
                                                                onClick={() => handleArchive(todo.id)}
                                                                disabled={actionLoading === todo.id}
                                                            >
                                                                <CIcon icon={cilTrash} />
                                                            </CButton>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </CTableDataCell>
                                    </CTableRow>
                                ))}
                            </CTableBody>
                        </CTable>
                    )}

                    {/* Paginazione sotto */}
                    <div className="mt-2">
                        <PaginationComponent />
                    </div>
                </CCardBody>
            </CCard>

            {/* Modal */}
            <TodoModal
                visible={showModal}
                onClose={() => { setShowModal(false); setEditingTodo(null); }}
                onSaved={loadTodos}
                editTodo={editingTodo}
            />
        </div>
    );
};

export default TodosPage;
