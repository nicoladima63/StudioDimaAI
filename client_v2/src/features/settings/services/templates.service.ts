import apiClient from '@/services/api/client';

export interface SmsTemplate {
  id: number;
  name: string;
  description: string;
  content: string;
}

export const templatesService = {
  /**
   * Fetches all available SMS templates.
   * This is a new endpoint that needs to be created in the backend.
   * For now, it might return an empty array or fail, but it's wired up correctly.
   */
  async getSmsTemplates(): Promise<SmsTemplate[]> {
    const response = await apiClient.get('sms-templates');
    return response.data.data || [];
  },
};

export default templatesService;