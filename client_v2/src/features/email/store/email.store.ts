import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { emailService } from '../services/emailService'
import type { EmailMessage, EmailScope, EmailFilterRule, EmailAiConfig } from '../types/email.types'

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface EmailStore {
  // State
  authenticated: boolean
  emails: EmailMessage[]
  relevantEmails: EmailMessage[]
  scopes: EmailScope[]
  rules: EmailFilterRule[]
  aiConfig: EmailAiConfig | null
  nextPageToken: string | null
  relevantNextPageToken: string | null
  loading: boolean
  loadingRelevant: boolean
  error: string | null
  lastFetched: number | null
  lastScopesFetched: number | null
  searchQuery: string
  selectedScopeIds: number[]

  rulesChanged: boolean

  // Actions
  checkAuth: () => Promise<void>
  fetchEmails: (reset?: boolean) => Promise<void>
  fetchRelevantEmails: (reset?: boolean) => Promise<void>
  fetchScopes: (force?: boolean) => Promise<void>
  fetchRules: (scopeId?: number) => Promise<void>
  fetchAiConfig: () => Promise<void>
  invalidateAndRefresh: () => Promise<void>
  setSearchQuery: (query: string) => void
  setSelectedScopeIds: (ids: number[]) => void
  clearError: () => void
}

export const useEmailStore = create<EmailStore>()(
  persist(
    immer((set, get) => ({
      authenticated: false,
      emails: [],
      relevantEmails: [],
      scopes: [],
      rules: [],
      aiConfig: null,
      nextPageToken: null,
      relevantNextPageToken: null,
      loading: false,
      loadingRelevant: false,
      error: null,
      lastFetched: null,
      lastScopesFetched: null,
      searchQuery: '',
      selectedScopeIds: [],
      rulesChanged: false,

      checkAuth: async () => {
        const result = await emailService.apiGetOAuthStatus()
        if (result.success && result.data) {
          set((state) => {
            state.authenticated = result.data!.authenticated
          })
        }
      },

      fetchEmails: async (reset = false) => {
        const { loading, nextPageToken, searchQuery } = get()
        if (loading) return

        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const result = await emailService.apiGetMessages(
            20,
            reset ? undefined : nextPageToken || undefined,
            searchQuery || undefined
          )

          if (result.success && result.data) {
            set((state) => {
              if (reset) {
                state.emails = result.data!.emails
              } else {
                state.emails = [...state.emails, ...result.data!.emails]
              }
              state.nextPageToken = result.data!.next_page_token
              state.loading = false
              state.lastFetched = Date.now()
            })
          } else {
            set((state) => {
              state.error = result.error || 'Errore recupero email'
              state.loading = false
            })
          }
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Errore recupero email'
            state.loading = false
          })
        }
      },

      fetchRelevantEmails: async (reset = false) => {
        const { loadingRelevant, relevantNextPageToken, selectedScopeIds, searchQuery } = get()
        if (loadingRelevant) return

        set((state) => {
          state.loadingRelevant = true
          state.error = null
        })

        try {
          const result = await emailService.apiGetRelevantMessages(
            50,
            reset ? undefined : relevantNextPageToken || undefined,
            selectedScopeIds.length ? selectedScopeIds : undefined,
            searchQuery || undefined
          )

          if (result.success && result.data) {
            set((state) => {
              if (reset) {
                state.relevantEmails = result.data!.emails
              } else {
                state.relevantEmails = [...state.relevantEmails, ...result.data!.emails]
              }
              state.relevantNextPageToken = result.data!.next_page_token
              state.loadingRelevant = false
            })
          } else {
            set((state) => {
              state.error = result.error || 'Errore recupero email pertinenti'
              state.loadingRelevant = false
            })
          }
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Errore recupero email pertinenti'
            state.loadingRelevant = false
          })
        }
      },

      fetchScopes: async (force = false) => {
        const { lastScopesFetched } = get()
        if (!force && lastScopesFetched && Date.now() - lastScopesFetched < CACHE_DURATION) return

        try {
          const result = await emailService.apiGetScopes()
          if (result.success && result.data) {
            set((state) => {
              state.scopes = result.data as EmailScope[]
              state.lastScopesFetched = Date.now()
            })
          }
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Errore recupero scopi'
          })
        }
      },

      fetchRules: async (scopeId?: number) => {
        try {
          const result = await emailService.apiGetRules(scopeId)
          if (result.success && result.data) {
            set((state) => {
              state.rules = result.data as EmailFilterRule[]
            })
          }
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Errore recupero regole'
          })
        }
      },

      fetchAiConfig: async () => {
        try {
          const result = await emailService.apiGetAiConfig()
          if (result.success) {
            set((state) => {
              state.aiConfig = (result.data as EmailAiConfig) || null
            })
          }
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Errore recupero config AI'
          })
        }
      },

      invalidateAndRefresh: async () => {
        try {
          await emailService.apiClearCache()
          set((state) => {
            state.rulesChanged = false
          })
          await get().fetchRelevantEmails(true)
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Errore invalidazione cache'
          })
        }
      },

      setSearchQuery: (query: string) => {
        set((state) => {
          state.searchQuery = query
        })
      },

      setSelectedScopeIds: (ids: number[]) => {
        set((state) => {
          state.selectedScopeIds = ids
        })
      },

      clearError: () => {
        set((state) => {
          state.error = null
        })
      },
    })),
    {
      name: 'email-storage',
      partialize: (state) => ({
        authenticated: state.authenticated,
        scopes: state.scopes,
        lastScopesFetched: state.lastScopesFetched,
        selectedScopeIds: state.selectedScopeIds,
      }),
    }
  )
)
