import apiClient from '@/services/api/client';

export interface Action {
  id: number;
  name: string;
  description: string;
  parameters: string[]; // Array of parameter names
  is_system_action: boolean;
}

export interface AutomationRule {
  id: number;
  name: string;
  description: string;
  trigger_type: string;
  trigger_id: string;
  action_id: number;
  action_name: string; // From join with actions table
  action_description: string; // From join with actions table
  action_params: any; // JSON object of parameters
  attiva: boolean;
  priorita: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRulePayload {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_id: string;
  action_id: number;
  action_params?: any;
  attiva?: boolean;
  priorita?: number;
}

export interface UpdateRulePayload {
  name?: string;
  description?: string;
  trigger_type?: string;
  trigger_id?: string;
  action_id?: number;
  action_params?: any;
  attiva?: boolean;
  priorita?: number;
}

const automationApi = {
  async getActions(): Promise<Action[]> {
    const response = await apiClient.get('/automations/actions');
    // handleApiResponse is for fetch, apiClient already handles errors and returns data directly
    return response.data.data || [];
  },

  async getRules(filters?: { attiva?: boolean; trigger_id?: string; monitor_id?: string }): Promise<AutomationRule[]> {
    const queryParams = new URLSearchParams();
    if (filters?.attiva !== undefined) {
      queryParams.append('attiva', String(filters.attiva));
    }
    if (filters?.trigger_id) {
      queryParams.append('trigger_id', filters.trigger_id);
    }
    if (filters?.monitor_id) {
      queryParams.append('monitor_id', filters.monitor_id);
    }
    const response = await apiClient.get(`/automations/rules?${queryParams.toString()}`);
    return response.data.data || [];
  },

  async getRuleById(ruleId: number): Promise<AutomationRule | null> {
    const response = await apiClient.get(`/automations/rules/${ruleId}`);
    return response.data.data || null;
  },

  async createRule(payload: CreateRulePayload): Promise<AutomationRule> {
    const response = await apiClient.post('/automations/rules', payload);
    return response.data.data;
  },

  async updateRule(ruleId: number, payload: UpdateRulePayload): Promise<AutomationRule> {
    const response = await apiClient.put(`/automations/rules/${ruleId}`, payload);
    return response.data.data;
  },

  async deleteRule(ruleId: number): Promise<boolean> {
    const response = await apiClient.delete(`/automations/rules/${ruleId}`);
    return response.data.success;
  },

  async toggleRule(ruleId: number): Promise<AutomationRule> {
    const response = await apiClient.post(`/automations/rules/${ruleId}/toggle`);
    return response.data.data;
  },
};

export default automationApi;