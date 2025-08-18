export interface ElectronAPI {
  // App info
  getVersion: () => Promise<string>
  
  // Storage
  store: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
    delete: (key: string) => Promise<void>
    clear: () => Promise<void>
  }
  
  // Automation
  startAutomation: (productData: any) => Promise<{ success: boolean; error?: string }>
  stopAutomation: () => Promise<{ success: boolean; error?: string }>
  getAutomationStatus: () => Promise<{
    isRunning: boolean
    progress: number
    currentStep: string
    startTime: Date | null
    endTime: Date | null
    error?: string
  }>
  
  // Logs
  getLogs: () => Promise<any[]>
  clearLogs: () => Promise<{ success: boolean; error?: string }>
  exportLogs: () => Promise<{ success: boolean; filePath?: string; error?: string }>
  
  // Settings
  getSettings: () => Promise<any>
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>
  testFacebookConnection: (credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>
  
  // Events
  onMenuAction: (callback: (action: string) => void) => void
  onAutomationUpdate: (callback: (status: any) => void) => void
  onLogUpdate: (callback: (log: any) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}