import React, { useEffect, useState, useCallback } from 'react'
import { Search, Filter, Trash2, Download, RefreshCw, AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react'
import useStore from '../hooks/useStore'
import socketService from '../services/socket'
import { clearLogs, getLogs } from '../services/api'
import { LogEntry } from '../types'
import { toast } from 'sonner'

const LogsPage: React.FC = () => {
  const logs = useStore(state => state.filteredLogs)
  const filter = useStore(state => state.logFilter)
  const addLog = useStore(state => state.addLog)
  const setLogs = useStore(state => state.setLogs)
  const clearLogsStore = useStore(state => state.clearLogs)
  const setFilter = useStore(state => state.setLogFilter)
  const isConnected = useStore(state => state.isConnected)
  const setError = useStore(state => state.setError)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const handleLogEntry = useCallback((log: LogEntry) => {
    addLog(log)
  }, [addLog])

  const handleLogsHistory = useCallback((logsHistory: LogEntry[]) => {
    setLogs(logsHistory)
  }, [setLogs])

  const handleLogsCleared = useCallback(() => {
    clearLogsStore()
    toast.success('Logs cleared successfully')
  }, [clearLogsStore])

  const handleLogsByLevel = useCallback((levelLogs: LogEntry[]) => {
    setLogs(levelLogs)
  }, [setLogs])

  useEffect(() => {
    // Connect to socket and set up listeners
    socketService.connect()

    socketService.onLogEntry(handleLogEntry)
    socketService.onLogsHistory(handleLogsHistory)
    socketService.onLogsCleared(handleLogsCleared)
    socketService.onLogsByLevel(handleLogsByLevel)

    // Request initial logs
    socketService.requestLogsHistory()

    return () => {
      socketService.offLogEntry(handleLogEntry)
      socketService.offLogsHistory(handleLogsHistory)
      socketService.offLogsCleared(handleLogsCleared)
      socketService.offLogsByLevel(handleLogsByLevel)
    }
  }, [handleLogEntry, handleLogsHistory, handleLogsCleared, handleLogsByLevel])

  const handleClearLogs = async () => {
    try {
      setIsLoading(true)
      const response = await clearLogs()
      
      if (response.success) {
        clearLogsStore()
        toast.success('Logs cleared successfully')
      } else {
        toast.error(response.error || 'Failed to clear logs')
      }
    } catch (error) {
      toast.error('Failed to clear logs')
      setError('Failed to clear logs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshLogs = async () => {
    try {
      setIsLoading(true)
      const response = await getLogs(filter === 'all' ? undefined : filter)
      
      if (response.success && response.data) {
        setLogs(response.data)
        toast.success('Logs refreshed')
      } else {
        toast.error(response.error || 'Failed to refresh logs')
      }
    } catch (error) {
      toast.error('Failed to refresh logs')
      setError('Failed to refresh logs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter)
    if (newFilter !== 'all') {
      socketService.requestLogsByLevel(newFilter)
    } else {
      socketService.requestLogsHistory()
    }
  }

  const handleDownloadLogs = () => {
    const logsText = filteredLogs.map(log => 
      `[${new Date(log.timestamp).toISOString()}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n')
    
    const blob = new Blob([logsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Logs downloaded')
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'warn':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'error':
        return 'border-l-red-500 bg-red-50'
      case 'warn':
        return 'border-l-yellow-500 bg-yellow-50'
      case 'success':
        return 'border-l-green-500 bg-green-50'
      default:
        return 'border-l-blue-500 bg-blue-50'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
          <p className="text-gray-600 mt-1">
            Monitor automation activities and system events
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshLogs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={handleDownloadLogs}
              className="flex items-center gap-2 px-4 py-2 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            
            <button
              onClick={handleClearLogs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Auto-scroll toggle */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="autoScroll"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="autoScroll" className="text-sm text-gray-600">
            Auto-scroll to new logs
          </label>
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Logs ({filteredLogs.length})
            </h2>
            {filter !== 'all' && (
              <span className="px-2 py-1 bg-brand-100 text-brand-800 rounded-full text-sm">
                Filtered by: {filter}
              </span>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Info className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No logs found</p>
              <p className="text-sm mt-1">Logs will appear here as the system runs</p>
            </div>
          ) : (
            <div className="space-y-1 p-4">
              {filteredLogs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={`flex items-start gap-3 p-3 border-l-4 rounded-r-lg ${getLogLevelClass(log.level)}`}
                >
                  {getLogIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.level === 'error' ? 'bg-red-100 text-red-800' :
                        log.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        log.level === 'success' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {log.level.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 break-words">
                      {log.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LogsPage