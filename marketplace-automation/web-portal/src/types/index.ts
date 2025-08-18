export interface ProductFormData {
  title: string
  price: string
  location: string
  description: string
  photo: File | null
}

export interface ValidationErrors {
  title?: string
  price?: string
  location?: string
  description?: string
  photo?: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  data?: any
}

export interface AutomationStatus {
  isRunning: boolean
  progress: number
  currentStep?: string
  error?: string
  startTime?: string | null
  endTime?: string | null
}

export interface SocketEvents {
  'automation-status': (status: AutomationStatus) => void
  'log-entry': (log: LogEntry) => void
  'logs-cleared': () => void
  'logs-history': (logs: LogEntry[]) => void
  'get-logs-by-level': (level: string) => void
  'logs-by-level': (logs: LogEntry[]) => void
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface FileUploadInfo {
  name: string
  size: number
  type: string
  lastModified: number
}