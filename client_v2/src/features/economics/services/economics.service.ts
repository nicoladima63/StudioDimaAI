import apiClient from '@/services/api/client'
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
  MultiYearComparison,
  TrimesterForecast,
  CollaboratoriRedditivitaData,
  ReportAppuntamentiData,
  ReportPrestazioniData,
} from '../types'

interface ApiResponse<T> {
  state: 'success' | 'warning' | 'error'
  data: T
  error?: string
}

export const economicsService = {
  async apiGetKpiCurrent(anno?: number): Promise<ApiResponse<KpiCurrent>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.get(`/economics/kpi/current?${params.toString()}`)
    return response.data
  },

  async apiGetKpiMonthly(anno?: number): Promise<ApiResponse<KpiMonthly>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.get(`/economics/kpi/monthly?${params.toString()}`)
    return response.data
  },

  async apiGetKpiByOperator(anno?: number): Promise<ApiResponse<KpiByOperator>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.get(`/economics/kpi/by-operator?${params.toString()}`)
    return response.data
  },

  async apiGetKpiByCategory(anno?: number): Promise<ApiResponse<KpiByCategory>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.get(`/economics/kpi/by-category?${params.toString()}`)
    return response.data
  },

  async apiGetKpiComparison(anno?: number): Promise<ApiResponse<KpiComparison>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.get(`/economics/kpi/comparison?${params.toString()}`)
    return response.data
  },

  async apiGetForecast(anno?: number): Promise<ApiResponse<ForecastData>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.get(`/economics/forecast?${params.toString()}`)
    return response.data
  },

  async apiSimulateScenario(params: SimulazioneParams): Promise<ApiResponse<SimulazioneResult>> {
    const response = await apiClient.post('/economics/scenario/simulate', params)
    return response.data
  },

  async apiGetSeasonality(): Promise<ApiResponse<SeasonalityData>> {
    const response = await apiClient.get('/economics/seasonality')
    return response.data
  },

  async apiGetTrend(): Promise<ApiResponse<TrendData>> {
    const response = await apiClient.get('/economics/trend')
    return response.data
  },

  async apiGetMultiYearComparison(anni: number[]): Promise<ApiResponse<MultiYearComparison>> {
    const params = new URLSearchParams()
    if (anni.length > 0) params.append('anni', anni.join(','))
    const response = await apiClient.get(`/economics/comparison/multi-year?${params.toString()}`)
    return response.data
  },

  async apiGetTrimesterForecast(anno?: number): Promise<ApiResponse<TrimesterForecast>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.get(`/economics/comparison/trimester-forecast?${params.toString()}`)
    return response.data
  },

  async apiGetCollaboratoriRedditivita(anno?: number): Promise<ApiResponse<CollaboratoriRedditivitaData>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.get(`/economics/collaboratori/redditivita?${params.toString()}`)
    return response.data
  },

  async apiInvalidateCache(anno?: number): Promise<ApiResponse<{ message: string }>> {
    const params = new URLSearchParams()
    if (anno) params.append('anno', anno.toString())
    const response = await apiClient.post(`/economics/cache/invalidate?${params.toString()}`)
    return response.data
  },

  async apiGetReportAppuntamenti(anno?: number, anni?: number[]): Promise<ApiResponse<ReportAppuntamentiData>> {
    const params = new URLSearchParams()
    if (anni && anni.length > 0) {
      params.append('anni', anni.join(','))
    } else if (anno) {
      params.append('anno', anno.toString())
    }
    const response = await apiClient.get(`/economics/report/appuntamenti?${params.toString()}`)
    return response.data
  },

  async apiGetReportPrestazioni(anno?: number, anni?: number[]): Promise<ApiResponse<ReportPrestazioniData>> {
    const params = new URLSearchParams()
    if (anni && anni.length > 0) {
      params.append('anni', anni.join(','))
    } else if (anno) {
      params.append('anno', anno.toString())
    }
    const response = await apiClient.get(`/economics/report/prestazioni?${params.toString()}`)
    return response.data
  },
}
