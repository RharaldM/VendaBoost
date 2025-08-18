import { io, Socket } from 'socket.io-client'
import { LogEntry, AutomationStatus } from '../types'

class SocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io('http://localhost:7849', {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true
    })

    this.setupEventListeners()
    return this.socket
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id)
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return
      }
      
      this.handleReconnect()
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.handleReconnect()
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts')
      this.reconnectAttempts = 0
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error)
    })
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      this.connect()
    }, delay)
  }

  // Event listeners
  onLogEntry(callback: (log: LogEntry) => void): void {
    this.socket?.on('log-entry', callback)
  }

  onAutomationStatus(callback: (status: AutomationStatus) => void): void {
    this.socket?.on('automation-status', callback)
  }

  onLogsCleared(callback: () => void): void {
    this.socket?.on('logs-cleared', callback)
  }

  onLogsHistory(callback: (logs: LogEntry[]) => void): void {
    this.socket?.on('logs-history', callback)
  }

  onLogsByLevel(callback: (logs: LogEntry[]) => void): void {
    this.socket?.on('logs-by-level', callback)
  }

  // Event emitters
  requestLogsHistory(): void {
    this.socket?.emit('get-logs-history')
  }

  requestLogsByLevel(level: string): void {
    this.socket?.emit('get-logs-by-level', level)
  }

  clearLogs(): void {
    this.socket?.emit('clear-logs')
  }

  // Remove event listeners
  offLogEntry(callback?: (log: LogEntry) => void): void {
    this.socket?.off('log-entry', callback)
  }

  offAutomationStatus(callback?: (status: AutomationStatus) => void): void {
    this.socket?.off('automation-status', callback)
  }

  offLogsCleared(callback?: () => void): void {
    this.socket?.off('logs-cleared', callback)
  }

  offLogsHistory(callback?: (logs: LogEntry[]) => void): void {
    this.socket?.off('logs-history', callback)
  }

  offLogsByLevel(callback?: (logs: LogEntry[]) => void): void {
    this.socket?.off('logs-by-level', callback)
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

// Create singleton instance
const socketService = new SocketService()

export default socketService