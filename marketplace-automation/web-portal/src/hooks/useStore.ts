import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { LogEntry, AutomationStatus } from '../types'

interface AppState {
  // Automation state
  automationStatus: AutomationStatus
  isAutomationRunning: boolean
  automationProgress: number
  currentStep: string
  
  // Logs state
  logs: LogEntry[]
  filteredLogs: LogEntry[]
  logFilter: string
  
  // UI state
  isLoading: boolean
  error: string | null
  isConnected: boolean
  
  // Actions
  setAutomationStatus: (status: AutomationStatus) => void
  setAutomationRunning: (running: boolean) => void
  setAutomationProgress: (progress: number) => void
  setCurrentStep: (step: string) => void
  
  addLog: (log: LogEntry) => void
  setLogs: (logs: LogEntry[]) => void
  clearLogs: () => void
  setLogFilter: (filter: string) => void
  
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setConnected: (connected: boolean) => void
}

const useStore = create<AppState>((set, get) => ({
  // Initial state
  automationStatus: {
    isRunning: false,
    progress: 0,
    currentStep: '',
    startTime: null,
    endTime: null,
    error: undefined
  },
  isAutomationRunning: false,
  automationProgress: 0,
  currentStep: '',
  
  logs: [],
  filteredLogs: [],
  logFilter: 'all',
  
  isLoading: false,
  error: null,
  isConnected: false,
  
  // Actions
  setAutomationStatus: (status) => {
    set({ 
      automationStatus: status,
      isAutomationRunning: status.isRunning,
      automationProgress: status.progress,
      currentStep: status.currentStep || ''
    })
  },
  
  setAutomationRunning: (running) => {
    set((state) => ({
      isAutomationRunning: running,
      automationStatus: {
        ...state.automationStatus,
        isRunning: running
      }
    }))
  },
  
  setAutomationProgress: (progress) => {
    set((state) => ({
      automationProgress: progress,
      automationStatus: {
        ...state.automationStatus,
        progress
      }
    }))
  },
  
  setCurrentStep: (step) => {
    set((state) => ({
      currentStep: step,
      automationStatus: {
        ...state.automationStatus,
        currentStep: step
      }
    }))
  },
  
  addLog: (log) => {
    set((state) => {
      const newLogs = [log, ...state.logs].slice(0, 1000) // Keep only last 1000 logs
      const filteredLogs = state.logFilter === 'all' 
        ? newLogs 
        : newLogs.filter(l => l.level === state.logFilter)
      return { logs: newLogs, filteredLogs }
    })
  },
  
  setLogs: (logs) => {
    set((state) => {
      const filteredLogs = state.logFilter === 'all' 
        ? logs 
        : logs.filter(log => log.level === state.logFilter)
      return { logs, filteredLogs }
    })
  },
  
  clearLogs: () => {
    set({ logs: [], filteredLogs: [] })
  },
  
  setLogFilter: (filter) => {
    set((state) => {
      const filteredLogs = filter === 'all' 
        ? state.logs 
        : state.logs.filter(log => log.level === filter)
      return { logFilter: filter, filteredLogs }
    })
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setConnected: (connected) => set({ isConnected: connected })
}))

export default useStore

// Selector hooks for better performance
export const useAutomationState = () => useStore((state) => ({
  status: state.automationStatus,
  isRunning: state.isAutomationRunning,
  progress: state.automationProgress,
  currentStep: state.currentStep,
  setStatus: state.setAutomationStatus,
  setRunning: state.setAutomationRunning,
  setProgress: state.setAutomationProgress,
  setCurrentStep: state.setCurrentStep
}))

export const useLogsState = () => useStore((state) => ({
  logs: state.filteredLogs,
  allLogs: state.logs,
  filter: state.logFilter,
  addLog: state.addLog,
  setLogs: state.setLogs,
  clearLogs: state.clearLogs,
  setFilter: state.setLogFilter
}))

export const useUIState = () => useStore((state) => ({
  isLoading: state.isLoading,
  error: state.error,
  isConnected: state.isConnected,
  setLoading: state.setLoading,
  setError: state.setError,
  setConnected: state.setConnected
}))