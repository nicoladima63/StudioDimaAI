import apiClient from '@/api/client';
import type {
  KpiCurrent,
  KpiMonthly,
  KpiByOperator,
  KpiByCategory,
  KpiComparison,
  ForecastData,
  SimulazioneParams,
  SimulazioneResult,
  SeasonalityData,
  TrendData,
} from '../types';

interface ApiResponse<T> {
  state: 'success' | 'warning' | 'error';
  data: T;
  error?: string;
}

export const economicsService = {
  async apiGetKpiCurrent(anno?: number): Promise<ApiResponse<KpiCurrent>> {
    const params = new URLSearchParams();
    if (anno) params.append('anno', anno.toString());
    const response = await apiClient.get(`/api/v2/economics/kpi/current?${params.toString()}`);
    return response.data;
  },

  async apiGetKpiMonthly(anno?: number): Promise<ApiResponse<KpiMonthly>> {
    const params = new URLSearchParams();
    if (anno) params.append('anno', anno.toString());
    const response = await apiClient.get(`/api/v2/economics/kpi/monthly?${params.toString()}`);
    return response.data;
  },

  async apiGetKpiByOperator(anno?: number): Promise<ApiResponse<KpiByOperator>> {
    const params = new URLSearchParams();
    if (anno) params.append('anno', anno.toString());
    const response = await apiClient.get(`/api/v2/economics/kpi/by-operator?${params.toString()}`);
    return response.data;
  },

  async apiGetKpiByCategory(anno?: number): Promise<ApiResponse<KpiByCategory>> {
    const params = new URLSearchParams();
    if (anno) params.append('anno', anno.toString());
    const response = await apiClient.get(`/api/v2/economics/kpi/by-category?${params.toString()}`);
    return response.data;
  },

  async apiGetKpiComparison(anno?: number): Promise<ApiResponse<KpiComparison>> {
    const params = new URLSearchParams();
    if (anno) params.append('anno', anno.toString());
    const response = await apiClient.get(`/api/v2/economics/kpi/comparison?${params.toString()}`);
    return response.data;
  },

  async apiGetForecast(anno?: number): Promise<ApiResponse<ForecastData>> {
    const params = new URLSearchParams();
    if (anno) params.append('anno', anno.toString());
    const response = await apiClient.get(`/api/v2/economics/forecast?${params.toString()}`);
    return response.data;
  },

  async apiSimulateScenario(params: SimulazioneParams): Promise<ApiResponse<SimulazioneResult>> {
    const response = await apiClient.post('/api/v2/economics/scenario/simulate', params);
    return response.data;
  },

  async apiGetSeasonality(): Promise<ApiResponse<SeasonalityData>> {
    const response = await apiClient.get('/api/v2/economics/seasonality');
    return response.data;
  },

  async apiGetTrend(): Promise<ApiResponse<TrendData>> {
    const response = await apiClient.get('/api/v2/economics/trend');
    return response.data;
  },

  async apiInvalidateCache(anno?: number): Promise<ApiResponse<{ message: string }>> {
    const params = new URLSearchParams();
    if (anno) params.append('anno', anno.toString());
    const response = await apiClient.post(`/api/v2/economics/cache/invalidate?${params.toString()}`);
    return response.data;
  },
};
