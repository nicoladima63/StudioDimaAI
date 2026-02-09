/**
 * Social Media Manager Service
 * Servizi API per Social Media Manager - Phase 2 (Calendar, Scheduling, AI)
 */

import apiClient from '@/services/api/client';
import type { ApiResponse } from '@/types';

export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  platforms: string[];
  category_id?: number;
  status: string;
  content_type: string;
  content?: string;
  hashtags?: string[];
  media_urls?: string[];
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
}

const socialMediaManagerService = {
  /**
   * Ottieni eventi calendario per posts schedulati
   * @param startDate Data inizio range (ISO format)
   * @param endDate Data fine range (ISO format)
   */
  apiGetCalendarEvents: async (
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<CalendarEventsResponse>> => {
    const response = await apiClient.get<ApiResponse<CalendarEventsResponse>>(
      `/social-media/calendar`,
      {
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      }
    );
    return response.data;
  },

  /**
   * Schedula pubblicazione post
   * @param postId ID del post
   * @param scheduledAt Data/ora di pubblicazione (ISO format)
   */
  apiSchedulePost: async (
    postId: number,
    scheduledAt: string
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/social-media/posts/${postId}/schedule`,
      {
        scheduled_at: scheduledAt,
      }
    );
    return response.data;
  },

  /**
   * Genera contenuto con AI
   * @param request Parametri per generazione AI
   */
  apiGenerateContent: async (request: {
    prompt: string;
    content_type: string;
    tone?: string;
    length?: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/social-media/ai/generate`,
      request
    );
    return response.data;
  },

  /**
   * Ottieni templates disponibili
   * @param type Tipo template (opzionale)
   */
  apiGetTemplates: async (type?: string): Promise<ApiResponse<any>> => {
    const params = type ? { type } : {};
    const response = await apiClient.get<ApiResponse<any>>(
      `/social-media/templates`,
      { params }
    );
    return response.data;
  },
};

export default socialMediaManagerService;
