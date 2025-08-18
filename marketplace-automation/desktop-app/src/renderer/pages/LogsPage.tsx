import { useState, useEffect } from 'react'
import { Search, Download, Trash2, AlertCircle, CheckCircle, Info, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  details?: string
  category: 'automation' | 'system' | 'user'
}

const LogsPage = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLogs()
  }, [])

  useEffect(() => {
    filterLogs()
  }, [logs, searchTerm, levelFilter, categoryFilter])

  const loadLogs = async () => {
    try {
      setIsLoading(true)
      // Get logs from the main process
      const logData = await window.electronAPI?.getLogs()
      
      if (logData) {
        const parsedLogs = logData.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }))
        setLogs(parsedLogs)
      } else {
        // Mock data for development
        const mockLogs: LogEntry[] = [
          {
            id: '1',
            timestamp: new Date(),
            level: 'success',
            message: 'Listing created successfully',
            details: 'Product "iPhone 13 Pro" was posted to Facebook Marketplace',
            category: 'automation'
          },
          {
            id: '2',
            timestamp: new Date(Date.now() - 300000),
            level: 'info',
            message: 'Automation started',
            details: 'Beginning Facebook Marketplace listing creation process',
            category: 'automation'
          },
          {
            id: '3',
            timestamp: new Date(Date.now() - 600000),
            level: 'warning',
            message: 'Photo upload took longer than expected',
            details: 'Upload time: 45 seconds (expected: <30 seconds)',
            category: 'automation'
          },
          {
            id: '4',
            timestamp: new Date(Date.now() - 900000),
            level: 'error',
            message: 'Failed to login to Facebook',
            details: 'Invalid credentials or account locked',
            category: 'automation'
          },
          {
            id: '5',
            timestamp: new Date(Date.now() - 1200000),
            level: 'info',
            message: 'Application started',
            details: 'Desktop app initialized successfully',
            category: 'system'
          }
        ]
        setLogs(mockLogs)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
      toast.error('Failed to load logs')
    } finally {
      setIsLoading(false)
    }
  }

  const filterLogs = () => {
    let filtered = logs

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter)
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(log => log.category === categoryFilter)
    }

    setFilteredLogs(filtered)
  }

  const clearLogs = async () => {
    try {
      const result = await window.electronAPI?.clearLogs()
      if (result?.success) {
        setLogs([])
        toast.success('Logs cleared successfully')
      } else {
        toast.error('Failed to clear logs')
      }
    } catch (error) {
      console.error('Failed to clear logs:', error)
      toast.error('Failed to clear logs')
    }
  }

  const exportLogs = async () => {
    try {
      const result = await window.electronAPI?.exportLogs()
      if (result?.success) {
        toast.success(`Logs exported to ${result.filePath}`)
      } else {
        toast.error('Failed to export logs')
      }
    } catch (error) {
      console.error('Failed to export logs:', error)
      toast.error('Failed to export logs')
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getLogBgColor = (level: string) => {
    switch (level) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Activity Logs</h1>
          <p className="text-gray-600">Monitor automation activities and system events</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-64"
                />
              </div>

              {/* Level Filter */}
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="input w-32"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input w-36"
              >
                <option value="all">All Categories</option>
                <option value="automation">Automation</option>
                <option value="system">System</option>
                <option value="user">User</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={exportLogs}
                className="btn btn-outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              <button
                onClick={clearLogs}
                className="btn btn-outline text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
                <div className="text-sm text-gray-600">Total Logs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {logs.filter(log => log.level === 'error').length}
                </div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {logs.filter(log => log.level === 'warning').length}
                </div>
                <div className="text-sm text-gray-600">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {logs.filter(log => log.level === 'success').length}
                </div>
                <div className="text-sm text-gray-600">Success</div>
              </div>
            </div>
          </div>
        </div>

        {/* Logs List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No logs found</p>
              <p className="text-sm text-gray-500">
                {searchTerm || levelFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Logs will appear here as activities occur'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <div key={log.id} className={`p-4 ${getLogBgColor(log.level)}`}>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getLogIcon(log.level)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {log.message}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span className="capitalize bg-gray-100 px-2 py-1 rounded">
                            {log.category}
                          </span>
                          <span>{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </div>
                      
                      {log.details && (
                        <p className="text-sm text-gray-700 mt-1">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination could be added here if needed */}
        {filteredLogs.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>
        )}
      </div>
    </div>
  )
}

export default LogsPage