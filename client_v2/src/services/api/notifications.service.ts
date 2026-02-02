import apiClient from './client'
import type { Notification } from '@/types'

const NOTIFICATIONS_URL = '/notifications'

export const notificationsService = {
  /**
   * Get unread notifications for current user
   */
  apiGetUnread: async (): Promise<{ notifications: Notification[]; count: number }> => {
    const response = await apiClient.get<any>(`${NOTIFICATIONS_URL}/unread`)
    const notifications = response.data.data?.notifications || []
    return {
      notifications,
      count: notifications.length // Use array length instead of backend count
    }
  },

  /**
   * Mark a single notification as read
   */
  apiMarkAsRead: async (notificationId: number): Promise<void> => {
    await apiClient.post(`${NOTIFICATIONS_URL}/${notificationId}/read`)
  },

  /**
   * Mark all notifications as read for current user
   */
  apiMarkAllAsRead: async (): Promise<{ count: number }> => {
    const response = await apiClient.post<any>(`${NOTIFICATIONS_URL}/mark-all-read`)
    return {
      count: response.data.data?.count || 0
    }
  }
}

export default notificationsService
