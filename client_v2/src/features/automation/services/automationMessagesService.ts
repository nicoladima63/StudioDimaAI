import apiClient from '@/services/api/client'

export type AutomationMessage = {
  id: number
  created_at: string
  trigger_type?: string
  trigger_id?: string
  monitor_id?: string
  rule_id?: number
  action_name?: string
  channel?: string
  recipient?: string
  message_text?: string
  result_json?: string
}

export const automationMessagesService = {
  async list(page = 1, per_page = 50) {
    const res = await apiClient.get('/automation/messages', { params: { page, per_page } })
    return res.data
  }
}

export default automationMessagesService
