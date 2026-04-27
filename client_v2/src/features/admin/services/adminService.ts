import apiClient from '@/services/api/client'

export interface BuildInfo {
  version: string
  build: number
  built_at: string
  git_hash: string
  env: string
}

const adminService = {
  async apiBuildInfo(): Promise<BuildInfo> {
    const res = await apiClient.get('/build-info')
    return res.data.data
  },

  async apiRestartServer(): Promise<void> {
    await apiClient.post('/admin/restart')
  },
}

export default adminService
