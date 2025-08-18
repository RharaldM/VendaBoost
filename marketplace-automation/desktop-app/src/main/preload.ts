import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../renderer/types/global'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  // App info
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Storage
  store: {
    get: (key: string) => ipcRenderer.invoke('get-store-value', key),
    set: (key: string, value: any) => ipcRenderer.invoke('set-store-value', key, value),
    delete: (key: string) => ipcRenderer.invoke('delete-store-value', key),
    clear: () => ipcRenderer.invoke('clear-store')
  },
  
  // Automation
  startAutomation: (productData: any) => ipcRenderer.invoke('start-automation', productData),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),
  getAutomationStatus: () => ipcRenderer.invoke('get-automation-status'),
  
  // Logs
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  exportLogs: () => ipcRenderer.invoke('export-logs'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  testFacebookConnection: (credentials: { email: string; password: string }) => ipcRenderer.invoke('test-facebook-connection', credentials),
  
  // Events
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_, action) => callback(action))
  },
  onAutomationUpdate: (callback: (status: any) => void) => {
    ipcRenderer.on('automation-update', (_, status) => callback(status))
  },
  onLogUpdate: (callback: (log: any) => void) => {
    ipcRenderer.on('log-update', (_, log) => callback(log))
  }
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI)