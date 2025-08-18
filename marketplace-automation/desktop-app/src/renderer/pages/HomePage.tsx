import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, FileText, Settings, Activity, Clock, CheckCircle, XCircle } from 'lucide-react'

interface AutomationStatus {
  isRunning: boolean
  progress: number
  currentStep: string
  startTime: Date | null
  endTime: Date | null
  error?: string
}

const HomePage = () => {
  const [status, setStatus] = useState<AutomationStatus>({
    isRunning: false,
    progress: 0,
    currentStep: 'Idle',
    startTime: null,
    endTime: null
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => {
    // Get initial automation status
    window.electronAPI?.getAutomationStatus().then(automationStatus => {
      setStatus(automationStatus)
    }).catch(() => {
      // Handle error silently
    })

    // Load recent activity from store
    window.electronAPI?.store.get('recentActivity').then((activity: any) => {
      if (activity && Array.isArray(activity)) {
        setRecentActivity(activity.slice(0, 5)) // Show last 5 activities
      }
    }).catch(() => {
      // Ignore errors, just use empty array
    })
  }, [])

  const quickActions = [
    {
      title: 'New Automation',
      description: 'Create a new marketplace listing',
      icon: Play,
      to: '/automation',
      color: 'bg-blue-500 hover:bg-blue-600',
      disabled: status.isRunning
    },
    {
      title: 'View Logs',
      description: 'Check automation activity logs',
      icon: FileText,
      to: '/logs',
      color: 'bg-green-500 hover:bg-green-600',
      disabled: false
    },
    {
      title: 'Settings',
      description: 'Configure automation settings',
      icon: Settings,
      to: '/settings',
      color: 'bg-purple-500 hover:bg-purple-600',
      disabled: false
    }
  ]

  const getStatusIcon = () => {
    if (status.isRunning) {
      return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
    } else if (status.error) {
      return <XCircle className="w-5 h-5 text-red-500" />
    } else {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
  }

  const getStatusText = () => {
    if (status.isRunning) {
      return 'Running'
    } else if (status.error) {
      return 'Error'
    } else {
      return 'Ready'
    }
  }

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleString()
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Monitor and control your marketplace automation</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Automation Status</h2>
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Current Step</div>
              <div className="text-lg font-medium text-gray-900">{status.currentStep}</div>
            </div>
            
            <div>
              <div className="text-sm text-gray-500 mb-1">Progress</div>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">{status.progress}%</span>
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-500 mb-1">Last Run</div>
              <div className="text-lg font-medium text-gray-900">
                {formatTime(status.endTime || status.startTime)}
              </div>
            </div>
          </div>

          {status.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">
                <strong>Error:</strong> {status.error}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.title}
                  to={action.to}
                  className={`block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 ${
                    action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300'
                  }`}
                  onClick={(e) => action.disabled && e.preventDefault()}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${action.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
                  <p className="text-gray-600 text-sm">{action.description}</p>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="p-4 flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{activity.title}</div>
                      <div className="text-xs text-gray-500">{activity.timestamp}</div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      activity.status === 'success' 
                        ? 'bg-green-100 text-green-800'
                        : activity.status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {activity.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Activity</h3>
                <p className="text-gray-600">Start your first automation to see activity here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage