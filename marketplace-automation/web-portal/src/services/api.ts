import { ProductFormData, ApiResponse, LogEntry } from '../types'

const API_BASE_URL = '/api'

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('API request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  private async uploadFile(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('File upload failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  async submitAutomation(data: ProductFormData): Promise<ApiResponse> {
    const formData = new FormData()
    formData.append('title', data.title)
    formData.append('price', data.price)
    formData.append('location', data.location)
    formData.append('description', data.description)
    
    if (data.photo) {
      formData.append('photos', data.photo)
    }

    return this.uploadFile('/items/schedule', formData)
  }

  async getAutomationStatus(): Promise<ApiResponse<{ isRunning: boolean; progress: number; currentStep?: string }>> {
    return this.request('/items/status')
  }

  async stopAutomation(): Promise<ApiResponse> {
    return this.request('/items/cancel', { method: 'POST' })
  }

  async getLogs(level?: string): Promise<ApiResponse<LogEntry[]>> {
    const endpoint = level ? `/logs?level=${level}` : '/logs'
    return this.request(endpoint)
  }

  async clearLogs(): Promise<ApiResponse> {
    return this.request('/logs', { method: 'DELETE' })
  }

  async getHealth(): Promise<ApiResponse<{ status: string; uptime: number; memory: any }>> {
    return this.request('/health')
  }

  async getSettings(): Promise<ApiResponse<any>> {
    return this.request('/settings')
  }

  async updateSettings(settings: any): Promise<ApiResponse> {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
  }
}

// Create singleton instance
const apiService = new ApiService()

// Export individual methods for easier importing
export const submitAutomation = (data: ProductFormData) => apiService.submitAutomation(data)
export const getAutomationStatus = () => apiService.getAutomationStatus()
export const stopAutomation = () => apiService.stopAutomation()
export const getLogs = (level?: string) => apiService.getLogs(level)
export const clearLogs = () => apiService.clearLogs()
export const getHealth = () => apiService.getHealth()
export const getSettings = () => apiService.getSettings()
export const updateSettings = (settings: any) => apiService.updateSettings(settings)

export default apiService