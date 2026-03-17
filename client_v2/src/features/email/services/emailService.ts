import apiClient from '@/services/api/client'
import type {
  EmailMessage,
  EmailMessageDetail,
  EmailScope,
  EmailFilterRule,
  EmailAiConfig,
  EmailListResponse,
  RelevantEmailsResponse,
  GmailLabel,
} from '../types/email.types'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
  state?: 'success' | 'warning' | 'error'
}

export const emailService = {
  // =========================================================================
  // OAuth
  // =========================================================================

  async apiGetOAuthUrl(): Promise<ApiResponse<{ auth_url: string }>> {
    try {
      const response = await apiClient.get('/email/oauth/url')
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore generazione URL OAuth',
        state: 'error',
      }
    }
  },

  async apiGetOAuthStatus(): Promise<ApiResponse<{ authenticated: boolean }>> {
    try {
      const response = await apiClient.get('/email/oauth/status')
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore verifica stato OAuth',
        state: 'error',
      }
    }
  },

  // =========================================================================
  // Email Messages
  // =========================================================================

  async apiGetMessages(
    maxResults = 20,
    pageToken?: string,
    query?: string
  ): Promise<ApiResponse<EmailListResponse>> {
    try {
      const params: Record<string, string | number> = { max_results: maxResults }
      if (pageToken) params.page_token = pageToken
      if (query) params.q = query
      const response = await apiClient.get('/email/messages', { params })
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore recupero email',
        state: 'error',
      }
    }
  },

  async apiGetMessageDetail(messageId: string): Promise<ApiResponse<EmailMessageDetail>> {
    try {
      const response = await apiClient.get(`/email/messages/${messageId}`)
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore dettaglio email',
        state: 'error',
      }
    }
  },

  async apiGetRelevantMessages(
    maxResults = 50,
    pageToken?: string,
    scopeIds?: number[],
    query?: string
  ): Promise<ApiResponse<RelevantEmailsResponse>> {
    try {
      const params: Record<string, string | number> = { max_results: maxResults }
      if (pageToken) params.page_token = pageToken
      if (scopeIds?.length) params.scope_ids = scopeIds.join(',')
      if (query) params.q = query
      const response = await apiClient.get('/email/messages/relevant', { params })
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore recupero email pertinenti',
        state: 'error',
      }
    }
  },

  async apiGetLabels(): Promise<ApiResponse<GmailLabel[]>> {
    try {
      const response = await apiClient.get('/email/labels')
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore recupero etichette',
        state: 'error',
      }
    }
  },

  // =========================================================================
  // Scopes
  // =========================================================================

  async apiGetScopes(): Promise<ApiResponse<EmailScope[]>> {
    try {
      const response = await apiClient.get('/email/scopes')
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore recupero scopi',
        state: 'error',
      }
    }
  },

  async apiCreateScope(data: Partial<EmailScope>): Promise<ApiResponse<EmailScope>> {
    try {
      const response = await apiClient.post('/email/scopes', data)
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore creazione scopo',
        state: 'error',
      }
    }
  },

  async apiUpdateScope(id: number, data: Partial<EmailScope>): Promise<ApiResponse<EmailScope>> {
    try {
      const response = await apiClient.put(`/email/scopes/${id}`, data)
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore aggiornamento scopo',
        state: 'error',
      }
    }
  },

  async apiDeleteScope(id: number): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`/email/scopes/${id}`)
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore eliminazione scopo',
        state: 'error',
      }
    }
  },

  // =========================================================================
  // Rules
  // =========================================================================

  async apiGetRules(scopeId?: number): Promise<ApiResponse<EmailFilterRule[]>> {
    try {
      const params: Record<string, number> = {}
      if (scopeId) params.scope_id = scopeId
      const response = await apiClient.get('/email/rules', { params })
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore recupero regole',
        state: 'error',
      }
    }
  },

  async apiCreateRule(data: Partial<EmailFilterRule>): Promise<ApiResponse<EmailFilterRule>> {
    try {
      const response = await apiClient.post('/email/rules', data)
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore creazione regola',
        state: 'error',
      }
    }
  },

  async apiUpdateRule(id: number, data: Partial<EmailFilterRule>): Promise<ApiResponse<EmailFilterRule>> {
    try {
      const response = await apiClient.put(`/email/rules/${id}`, data)
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore aggiornamento regola',
        state: 'error',
      }
    }
  },

  async apiDeleteRule(id: number): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`/email/rules/${id}`)
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore eliminazione regola',
        state: 'error',
      }
    }
  },

  // =========================================================================
  // AI Config
  // =========================================================================

  async apiGetAiConfig(): Promise<ApiResponse<EmailAiConfig>> {
    try {
      const response = await apiClient.get('/email/ai/config')
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore recupero config AI',
        state: 'error',
      }
    }
  },

  async apiSaveAiConfig(data: Partial<EmailAiConfig>): Promise<ApiResponse<EmailAiConfig>> {
    try {
      const response = await apiClient.put('/email/ai/config', data)
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore salvataggio config AI',
        state: 'error',
      }
    }
  },

  async apiTestAiClassification(email: EmailMessage): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/email/ai/test', { email })
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore test classificazione AI',
        state: 'error',
      }
    }
  },

  // =========================================================================
  // Cache
  // =========================================================================

  async apiClearCache(): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/email/cache/clear')
      return response.data
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore svuotamento cache',
        state: 'error',
      }
    }
  },
}
