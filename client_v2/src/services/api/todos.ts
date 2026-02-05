import apiClient from './client';

export interface Todo {
  id: number;
  sender_id: number;
  recipient_id: number;
  subject: string;
  message?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  status: 'pending' | 'read' | 'completed' | 'archived';
  type: 'general' | 'approval' | 'request' | 'notification';
  related_task_id?: number;
  related_step_id?: number;
  urgency_level: 'normal' | 'attention' | 'urgent' | 'critical';
  created_at: string;
  updated_at: string;
}

export interface TodoListResponse {
  success: boolean;
  data: Todo[];
  total?: number;
  message?: string;
}

export interface TodoResponse {
  success: boolean;
  data?: Todo;
  message?: string;
}

export interface SnoozeResponse {
  success: boolean;
  days?: number;
  message?: string;
}

export interface PostponeTaskResponse {
  success: boolean;
  postponed_count?: number;
  days?: number;
  message?: string;
}

class TodoService {
  /**
   * Get all todos with optional filters
   */
  async getAll(userId: number, filters?: {
    status?: string;
    priority?: string;
    type?: string;
  }): Promise<TodoListResponse> {
    const params = new URLSearchParams({ user_id: userId.toString() });
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.type) params.append('type', filters.type);

    return apiClient.get(`/todos?${params.toString()}`);
  }

  /**
   * Get inbox (received todos)
   */
  async getInbox(userId: number): Promise<TodoListResponse> {
    return apiClient.get(`/todos/inbox?user_id=${userId}`);
  }

  /**
   * Get sent todos
   */
  async getSent(userId: number): Promise<TodoListResponse> {
    return apiClient.get(`/todos/sent?user_id=${userId}`);
  }

  /**
   * Get pending todos (shortcut)
   */
  async getPending(userId: number): Promise<TodoListResponse> {
    return apiClient.get(`/todos/pending?user_id=${userId}`);
  }

  /**
   * Get single todo by ID
   */
  async getById(todoId: number): Promise<TodoResponse> {
    return apiClient.get(`/todos/${todoId}`);
  }

  /**
   * Create new todo
   */
  async create(data: {
    sender_id: number;
    recipient_id: number;
    subject: string;
    message?: string;
    priority?: string;
    due_date?: string;
    type?: string;
    related_task_id?: number;
    related_step_id?: number;
  }): Promise<TodoResponse> {
    return apiClient.post('/todos', data);
  }

  /**
   * Update todo
   */
  async update(todoId: number, data: Partial<Todo>): Promise<TodoResponse> {
    return apiClient.patch(`/todos/${todoId}`, data);
  }

  /**
   * Mark todo as completed
   */
  async complete(todoId: number, userId: number): Promise<TodoResponse> {
    return apiClient.post(`/todos/${todoId}/complete`, { user_id: userId });
  }

  /**
   * Mark todo as read
   */
  async markAsRead(todoId: number, userId: number): Promise<TodoResponse> {
    return apiClient.post(`/todos/${todoId}/read`, { user_id: userId });
  }

  /**
   * Archive (soft delete) todo
   */
  async archive(todoId: number): Promise<TodoResponse> {
    return apiClient.delete(`/todos/${todoId}`);
  }

  /**
   * Snooze/postpone a todo by X days
   */
  async snooze(todoId: number, userId: number, days: number = 1): Promise<SnoozeResponse> {
    return apiClient.post(`/todos/${todoId}/snooze`, { user_id: userId, days });
  }

  /**
   * Postpone all todos of a task
   */
  async postponeTaskTodos(taskId: number, userId: number, days: number = 7): Promise<PostponeTaskResponse> {
    return apiClient.post(`/tasks/${taskId}/todos/postpone`, { user_id: userId, days });
  }
}

export const todoService = new TodoService();
