export interface EmailMessage {
  id: string
  thread_id: string
  subject: string
  from_name: string
  from_email: string
  to: string
  date: string
  snippet: string
  label_ids: string[]
  is_unread: boolean
  classification?: EmailClassification
}

export interface EmailMessageDetail extends EmailMessage {
  body_html: string
  body_text: string
  attachments: EmailAttachment[]
  size_estimate: number
}

export interface EmailAttachment {
  filename: string
  mime_type: string
  size: number
  attachment_id: string
}

export interface EmailClassification {
  scope_id: number
  scope_name: string
  scope_label: string
  scope_color: string
  confidence: number
  source: 'rule' | 'ai' | 'cache'
}

export interface EmailScope {
  id: number
  name: string
  label: string
  description: string
  icon: string
  color: string
  is_default: number
  active: number
  created_at: string
}

export type EmailAlertMode = 'none' | 'alert' | 'todo'
export type EmailAlertPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface EmailAlertConfigItem {
  scope_id: number
  scope_label: string
  scope_color: string | null
  scope_active: boolean
  mode: EmailAlertMode
  recipient_id: number | null
  recipient_username: string | null
  priority: EmailAlertPriority
  due_days: number
}

export interface EmailAlertConfig {
  items: EmailAlertConfigItem[]
  default_recipient_id: number | null
}

export interface EmailAlertConfigPayload {
  mode: EmailAlertMode
  recipient_id: number | null
  priority: EmailAlertPriority
  due_days: number
}

export interface EmailAlertPreviewItem {
  message_id: string
  mode: EmailAlertMode
  scope_label: string
  sender: string
  subject: string
  text: string | null
}

export interface EmailAlertRunResult {
  state: 'success' | 'warning' | 'error'
  message: string
  checked: number
  matched: number
  alerts: number
  todos: number
  failed: number
  would_send: EmailAlertPreviewItem[]
}

export interface EmailAlertLogItem {
  message_id: string
  scope_label: string | null
  action: 'alert' | 'todo'
  recipient_username: string | null
  todo_id: number | null
  subject: string | null
  sender: string | null
  processed_at: number
}

export interface EmailFilterRule {
  id: number
  scope_id: number
  scope_name?: string
  scope_label?: string
  field: 'from' | 'subject' | 'body' | 'snippet' | 'to'
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex'
  value: string
  priority: number
  active: number
  created_at: string
}

export interface EmailAiConfig {
  id?: number
  provider: string
  api_key?: string
  api_key_masked?: string
  model: string
  active: number
}

export interface EmailListResponse {
  emails: EmailMessage[]
  next_page_token: string | null
  result_size_estimate: number
}

export interface RelevantEmailsResponse {
  emails: EmailMessage[]
  next_page_token: string | null
  total_fetched: number
  total_relevant: number
}

export interface GmailLabel {
  id: string
  name: string
  type: string
}
