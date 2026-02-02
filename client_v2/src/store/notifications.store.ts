import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import notificationsService from '@/services/api/notifications.service'
import type { Notification, LoadingState } from '@/types'

const CACHE_DURATION = 30 * 1000 // 30 seconds cache

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  loading: LoadingState
  error: string | null
  lastFetched: number | null

  // Actions
  fetchUnread: () => Promise<void>
  markAsRead: (notificationId: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  clearError: () => void

  // Helper
  shouldRefetch: () => boolean
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    immer((set, get) => ({
      notifications: [],
      unreadCount: 0,
      loading: 'idle',
      error: null,
      lastFetched: null,

      shouldRefetch: () => {
        const { lastFetched } = get()
        if (!lastFetched) return true
        return Date.now() - lastFetched > CACHE_DURATION
      },

      fetchUnread: async () => {
        // Check cache first
        if (!get().shouldRefetch() && get().loading === 'success') {
          return
        }

        set((state) => {
          state.loading = 'loading'
          state.error = null
        })

        try {
          const { notifications, count } = await notificationsService.apiGetUnread()

          set((state) => {
            state.notifications = notifications
            state.unreadCount = count
            state.loading = 'success'
            state.lastFetched = Date.now()
          })
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Failed to fetch notifications'
            state.loading = 'error'
          })
        }
      },

      markAsRead: async (notificationId: number) => {
        try {
          await notificationsService.apiMarkAsRead(notificationId)

          set((state) => {
            // Remove from unread list
            state.notifications = state.notifications.filter((n) => n.id !== notificationId)
            state.unreadCount = Math.max(0, state.unreadCount - 1)
          })
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Failed to mark notification as read'
          })
          throw err
        }
      },

      markAllAsRead: async () => {
        try {
          await notificationsService.apiMarkAllAsRead()

          set((state) => {
            state.notifications = []
            state.unreadCount = 0
          })
        } catch (err: any) {
          set((state) => {
            state.error = err.message || 'Failed to mark all notifications as read'
          })
          throw err
        }
      },

      clearError: () => {
        set((state) => {
          state.error = null
        })
      }
    })),
    {
      name: 'notifications-storage',
      partialize: (state) => ({
        // Only persist data, not loading states
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        lastFetched: state.lastFetched
      })
    }
  )
)
