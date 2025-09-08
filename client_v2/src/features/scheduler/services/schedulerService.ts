import apiClient from '@/services/api/client';

export interface SchedulerJob {
    id: string;
    name: string;
    next_run: string | null;
    trigger: string;
}

export interface SchedulerStatus {
    running: boolean;
    jobs: SchedulerJob[];
}

export interface SchedulerSettings {
    reminder_enabled: boolean;
    reminder_hour: number;
    reminder_minute: number;
    recall_enabled: boolean;
    recall_hour: number;
    recall_minute: number;
    calendar_sync_enabled: boolean;
    calendar_sync_hour: number;
    calendar_sync_minute: number;
    calendar_studio_blu_id: string;
    calendar_studio_giallo_id: string;
}

export interface LogEntry {
    timestamp: string;
    sent?: number;
    success?: number;
    errors?: Array<{
        paziente: string;
        numero: string;
        errore: string;
    }>;
    total_synced?: number;
    total_errors?: number;
    months_processed?: number;
}

const schedulerService = {
    async apiGetStatus(): Promise<{
        scheduler: SchedulerStatus;
        settings: SchedulerSettings;
    }> {
        const response = await apiClient.get('/scheduler/status');
        return response.data.data;
    },

    async apiStart(): Promise<{ message: string; status: SchedulerStatus }> {
        const response = await apiClient.post('/scheduler/start');
        return response.data.data;
    },

    async apiStop(): Promise<{ message: string }> {
        const response = await apiClient.post('/scheduler/stop');
        return response.data.data;
    },

    async apiUpdateSettings(
        service: 'reminder' | 'recall' | 'calendar',
        settings: Partial<SchedulerSettings>
    ): Promise<{
        message: string;
        settings: Partial<SchedulerSettings>;
    }> {
        let endpoint = '';
        let payload: any = {};

        if (service === 'reminder') {
            endpoint = '/scheduler/reminder/settings';
            payload = {
                enabled: settings.reminder_enabled,
                hour: settings.reminder_hour,
                minute: settings.reminder_minute
            };
        } else if (service === 'recall') {
            endpoint = '/scheduler/recall/settings';
            payload = {
                enabled: settings.recall_enabled,
                hour: settings.recall_hour,
                minute: settings.recall_minute
            };
        } else if (service === 'calendar') {
            endpoint = '/scheduler/calendar/settings';
            payload = {
                enabled: settings.calendar_sync_enabled,
                hour: settings.calendar_sync_hour,
                minute: settings.calendar_sync_minute,
                calendar_studio_blu_id: settings.calendar_studio_blu_id,
                calendar_studio_giallo_id: settings.calendar_studio_giallo_id
            };
        }

        const response = await apiClient.put(endpoint, payload);
        return response.data.data;
    },

    async apiGetLogs(type: 'recall' | 'calendar'): Promise<LogEntry[]> {
        const endpoint = type === 'recall' 
            ? '/scheduler/logs/recall'
            : '/scheduler/logs/calendar';
        
        const response = await apiClient.get(endpoint);
        return response.data.data;
    }
};

export { schedulerService };