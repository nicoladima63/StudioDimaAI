
import apiClient from './api/client';
import { Work, Task, Provider } from '../types/works.types';

const WORKS_URL = '/works';
const TASKS_URL = '/tasks';
const PROVIDERS_URL = '/providers';

export const worksService = {
  // WORKS (Templates)
  getAllWorks: async (): Promise<Work[]> => {
    const response = await apiClient.get<any>(WORKS_URL);
    return response.data.data;
  },
  
  getWork: async (id: number): Promise<Work> => {
    const response = await apiClient.get<any>(`${WORKS_URL}/${id}`);
    return response.data.data ? response.data.data : response.data;
  },
  
  createWork: async (work: Partial<Work>): Promise<Work> => {
    const response = await apiClient.post<any>(WORKS_URL, { work, steps: work.steps || [] });
    return response.data.data;
  },
  
  updateWork: async (id: number, work: Partial<Work>): Promise<Work> => {
    const response = await apiClient.put<any>(`${WORKS_URL}/${id}`, work);
    return response.data.data;
  },
  
  deleteWork: async (id: number): Promise<void> => {
    await apiClient.delete(`${WORKS_URL}/${id}`);
  },

  // TASKS (Instances)
  getAllTasks: async (filters?: any): Promise<Task[]> => {
    const response = await apiClient.get<any>(TASKS_URL, { params: filters });
    return response.data.data;
  },
  
  getTask: async (id: number): Promise<Task> => {
    const response = await apiClient.get<any>(`${TASKS_URL}/${id}`);
    return response.data.data;
  },
  
  createTask: async (task: Partial<Task>): Promise<Task> => {
    const response = await apiClient.post<any>(TASKS_URL, task);
    return response.data.data;
  },
  
  updateTaskStatus: async (id: number, status: string): Promise<Task> => {
    const response = await apiClient.patch<any>(`${TASKS_URL}/${id}/status`, { status });
    return response.data.data;
  },

  deleteTask: async (id: number): Promise<void> => {
    await apiClient.delete(`${TASKS_URL}/${id}`);
  },

  resetTask: async (id: number): Promise<Task> => {
    const response = await apiClient.post<any>(`${TASKS_URL}/${id}/reset`);
    return response.data.data;
  },
  
  // PROVIDERS
  getAllProviders: async (): Promise<Provider[]> => {
    const response = await apiClient.get<any>(PROVIDERS_URL);
    return response.data.data;
  },
  
  createProvider: async (provider: Partial<Provider>): Promise<Provider> => {
    const response = await apiClient.post<any>(PROVIDERS_URL, provider);
    return response.data.data;
  },
  
  updateProvider: async (id: number, provider: Partial<Provider>): Promise<Provider> => {
    const response = await apiClient.put<any>(`${PROVIDERS_URL}/${id}`, provider);
    return response.data.data;
  },
  
  deleteProvider: async (id: number): Promise<void> => {
    await apiClient.delete(`${PROVIDERS_URL}/${id}`);
  },
  
  // STEPS (Instances/Templates)
  completeStep: async (taskId: number, stepId: number): Promise<Task> => {
    const response = await apiClient.post<any>(`${TASKS_URL}/${taskId}/steps/${stepId}/complete`);
    return response.data.data;
  }
};
