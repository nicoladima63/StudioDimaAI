import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CButton, CBadge, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilBell, cilCheckCircle, cilClock, cilArrowRight } from '@coreui/icons';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { todoService, Todo } from '@/services/api/todos';

const TodoWidget: React.FC = () => {
    const { user } = useAuthStore();
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);
    const [completingId, setCompletingId] = useState<number | null>(null);

    useEffect(() => {
        if (user?.id) {
            loadTodos();
        }
    }, [user]);

    const loadTodos = async () => {
        try {
            setLoading(true);
            const response = await todoService.getPending(user!.id);
            if (response.success && response.data) {
                // Prendi solo i primi 7 todo più urgenti
                setTodos(response.data.slice(0, 7));
            }
        } catch (error) {
            console.error('Error loading todos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (todoId: number) => {
        try {
            setCompletingId(todoId);
            const response = await todoService.complete(todoId, user!.id);
            if (response.success) {
                // Rimuovi dalla lista con animazione
                setTodos(prev => prev.filter(t => t.id !== todoId));
            }
        } catch (error) {
            console.error('Error completing todo:', error);
        } finally {
            setCompletingId(null);
        }
    };

    const handleSnooze = async (todoId: number) => {
        try {
            const response = await todoService.snooze(todoId, user!.id, 1);
            if (response.success) {
                // Rimuovi dalla lista
                setTodos(prev => prev.filter(t => t.id !== todoId));
            }
        } catch (error) {
            console.error('Error snoozing todo:', error);
        }
    };

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'critical': return 'danger';
            case 'urgent': return 'warning';
            case 'attention': return 'info';
            default: return 'secondary';
        }
    };

    const getUrgencyIcon = (urgency: string) => {
        switch (urgency) {
            case 'critical': return '🚨';
            case 'urgent': return '🔥';
            case 'attention': return '⚠️';
            default: return '✓';
        }
    };

    const getUrgencyLabel = (urgency: string) => {
        switch (urgency) {
            case 'critical': return 'CRITICO';
            case 'urgent': return 'URGENTE';
            case 'attention': return 'ATTENZIONE';
            default: return 'NORMALE';
        }
    };

    const formatDueDate = (dueDate: string | null) => {
        if (!dueDate) return null;
        try {
            const date = new Date(dueDate);
            const now = new Date();
            const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                return `Scaduto ${Math.abs(diffDays)} giorni fa`;
            } else if (diffDays === 0) {
                return 'Scade oggi';
            } else if (diffDays === 1) {
                return 'Scade domani';
            } else {
                return `Scade tra ${diffDays} giorni`;
            }
        } catch {
            return null;
        }
    };

    const totalCount = todos.length;
    const criticalCount = todos.filter(t => t.urgency_level === 'critical').length;
    const urgentCount = todos.filter(t => t.urgency_level === 'urgent').length;

    return (
        <CCard className="mb-4 h-100">
            <CCardHeader className="d-flex justify-content-between align-items-center">
                <div>
                    <CIcon icon={cilBell} className="me-2" />
                    <strong>I Miei Todo</strong>
                    {totalCount > 0 && (
                        <CBadge
                            color={criticalCount > 0 ? 'danger' : urgentCount > 0 ? 'warning' : 'info'}
                            className="ms-2"
                        >
                            {totalCount}
                        </CBadge>
                    )}
                </div>
                <NavLink to="/todos" className="btn btn-sm btn-primary">
                    Vedi tutti
                    <CIcon icon={cilArrowRight} className="ms-1" size="sm" />
                </NavLink>
            </CCardHeader>
            <CCardBody style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {loading ? (
                    <div className="text-center py-4">
                        <CSpinner color="primary" />
                    </div>
                ) : todos.length === 0 ? (
                    <div className="text-center text-muted py-4">
                        <div className="mb-2" style={{ fontSize: '3rem' }}>✓</div>
                        <p className="mb-0">Nessun todo pendente!</p>
                        <small>Ottimo lavoro! 🎉</small>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {todos.map((todo) => (
                            <div
                                key={todo.id}
                                className={`p-3 rounded border border-${getUrgencyColor(todo.urgency_level)} bg-light`}
                                style={{
                                    borderWidth: todo.urgency_level === 'critical' ? '3px' : '1px',
                                    animation: todo.urgency_level === 'critical' ? 'pulse 2s infinite' : 'none'
                                }}
                            >
                                {/* Header con urgenza */}
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <CBadge color={getUrgencyColor(todo.urgency_level)} className="me-2">
                                            {getUrgencyIcon(todo.urgency_level)} {getUrgencyLabel(todo.urgency_level)}
                                        </CBadge>
                                        {todo.priority && (
                                            <CBadge color="secondary" className="text-uppercase">
                                                {todo.priority}
                                            </CBadge>
                                        )}
                                    </div>
                                </div>

                                {/* Contenuto */}
                                <div className="mb-2">
                                    <strong className="d-block mb-1">{todo.subject}</strong>
                                    {todo.message && (
                                        <small className="text-muted d-block">{todo.message}</small>
                                    )}
                                </div>

                                {/* Info aggiuntive */}
                                {todo.due_date && (
                                    <div className="mb-2">
                                        <small className={`text-${todo.urgency_level === 'normal' ? 'muted' : 'danger'}`}>
                                            📅 {formatDueDate(todo.due_date)}
                                        </small>
                                    </div>
                                )}

                                {/* Azioni */}
                                <div className="d-flex gap-2 mt-2">
                                    <CButton
                                        color="success"
                                        size="sm"
                                        onClick={() => handleComplete(todo.id)}
                                        disabled={completingId === todo.id}
                                    >
                                        {completingId === todo.id ? (
                                            <CSpinner size="sm" />
                                        ) : (
                                            <>
                                                <CIcon icon={cilCheckCircle} className="me-1" size="sm" />
                                                Completa
                                            </>
                                        )}
                                    </CButton>
                                    <CButton
                                        color="info"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSnooze(todo.id)}
                                    >
                                        <CIcon icon={cilClock} className="me-1" size="sm" />
                                        +1 giorno
                                    </CButton>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CCardBody>

            {/* CSS per animazione pulse */}
            <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
          }
        }
      `}</style>
        </CCard>
    );
};

export default TodoWidget;
