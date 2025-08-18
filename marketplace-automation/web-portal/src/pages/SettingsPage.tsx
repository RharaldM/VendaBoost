import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, Settings, Shield, Bell, Monitor, Database, Globe } from 'lucide-react'
import { getSettings, updateSettings, getHealth } from '../services/api'
import { useUIState } from '../hooks/useStore'
import { toast } from 'sonner'

interface SettingsData {
  automation: {
    timeout: number
    retryAttempts: number
    headless: boolean
    slowMo: number
  }
  facebook: {
    email: string
    password: string
    rememberLogin: boolean
  }
  notifications: {
    enableDesktop: boolean
    enableSound: boolean
    logLevel: string
  }
  system: {
    autoStart: boolean
    minimizeToTray: boolean
    checkUpdates: boolean
    logRetention: number
  }
}

const SettingsPage: React.FC = () => {
  const { setError } = useUIState()
  const [settings, setSettings] = useState<SettingsData>({
    automation: {
      timeout: 30000,
      retryAttempts: 3,
      headless: true,
      slowMo: 100
    },
    facebook: {
      email: '',
      password: '',
      rememberLogin: true
    },
    notifications: {
      enableDesktop: true,
      enableSound: false,
      logLevel: 'info'
    },
    system: {
      autoStart: false,
      minimizeToTray: true,
      checkUpdates: true,
      logRetention: 7
    }
  })
  
  const [isLoading, setIsLoadingLocal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [systemInfo, setSystemInfo] = useState<any>(null)

  useEffect(() => {
    loadSettings()
    loadSystemInfo()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoadingLocal(true)
      const response = await getSettings()
      
      if (response.success && response.data) {
        setSettings(response.data)
      }
    } catch (error) {
      toast.error('Failed to load settings')
      setError('Failed to load settings')
    } finally {
      setIsLoadingLocal(false)
    }
  }

  const loadSystemInfo = async () => {
    try {
      const response = await getHealth()
      
      if (response.success && response.data) {
        setSystemInfo(response.data)
      }
    } catch (error) {
      console.error('Failed to load system info:', error)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true)
      const response = await updateSettings(settings)
      
      if (response.success) {
        setHasChanges(false)
        toast.success('Settings saved successfully')
      } else {
        toast.error(response.error || 'Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings')
      setError('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (section: keyof SettingsData, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
    setHasChanges(true)
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024
    return `${mb.toFixed(1)} MB`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure automation behavior and system preferences
          </p>
        </div>
        
        <button
          onClick={handleSaveSettings}
          disabled={!hasChanges || isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panels */}
        <div className="lg:col-span-2 space-y-6">
          {/* Automation Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg font-semibold text-gray-900">Automation Settings</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  value={settings.automation.timeout}
                  onChange={(e) => handleInputChange('automation', 'timeout', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  min="5000"
                  max="120000"
                  step="1000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Retry Attempts
                </label>
                <input
                  type="number"
                  value={settings.automation.retryAttempts}
                  onChange={(e) => handleInputChange('automation', 'retryAttempts', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  min="1"
                  max="10"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slow Motion (ms)
                </label>
                <input
                  type="number"
                  value={settings.automation.slowMo}
                  onChange={(e) => handleInputChange('automation', 'slowMo', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  min="0"
                  max="1000"
                  step="50"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="headless"
                  checked={settings.automation.headless}
                  onChange={(e) => handleInputChange('automation', 'headless', e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="headless" className="ml-2 text-sm text-gray-700">
                  Run in headless mode
                </label>
              </div>
            </div>
          </div>

          {/* Facebook Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Facebook Account</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.facebook.email}
                  onChange={(e) => handleInputChange('facebook', 'email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="your.email@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={settings.facebook.password}
                  onChange={(e) => handleInputChange('facebook', 'password', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberLogin"
                  checked={settings.facebook.rememberLogin}
                  onChange={(e) => handleInputChange('facebook', 'rememberLogin', e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="rememberLogin" className="ml-2 text-sm text-gray-700">
                  Remember login session
                </label>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableDesktop"
                  checked={settings.notifications.enableDesktop}
                  onChange={(e) => handleInputChange('notifications', 'enableDesktop', e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="enableDesktop" className="ml-2 text-sm text-gray-700">
                  Enable desktop notifications
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableSound"
                  checked={settings.notifications.enableSound}
                  onChange={(e) => handleInputChange('notifications', 'enableSound', e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="enableSound" className="ml-2 text-sm text-gray-700">
                  Enable sound notifications
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Log Level
                </label>
                <select
                  value={settings.notifications.logLevel}
                  onChange={(e) => handleInputChange('notifications', 'logLevel', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="error">Error only</option>
                  <option value="warn">Warning &amp; Error</option>
                  <option value="info">Info, Warning &amp; Error</option>
                  <option value="debug">All logs</option>
                </select>
              </div>
            </div>
          </div>

          {/* System Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Monitor className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">System</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoStart"
                  checked={settings.system.autoStart}
                  onChange={(e) => handleInputChange('system', 'autoStart', e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="autoStart" className="ml-2 text-sm text-gray-700">
                  Start with system
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="minimizeToTray"
                  checked={settings.system.minimizeToTray}
                  onChange={(e) => handleInputChange('system', 'minimizeToTray', e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="minimizeToTray" className="ml-2 text-sm text-gray-700">
                  Minimize to system tray
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="checkUpdates"
                  checked={settings.system.checkUpdates}
                  onChange={(e) => handleInputChange('system', 'checkUpdates', e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="checkUpdates" className="ml-2 text-sm text-gray-700">
                  Check for updates automatically
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Log Retention (days)
                </label>
                <input
                  type="number"
                  value={settings.system.logRetention}
                  onChange={(e) => handleInputChange('system', 'logRetention', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  min="1"
                  max="30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* System Info Sidebar */}
        <div className="space-y-6">
          {/* System Status */}
          {systemInfo && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className="text-sm font-medium text-green-600">
                    {systemInfo.status || 'Running'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Uptime</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatUptime(systemInfo.uptime || 0)}
                  </span>
                </div>
                
                {systemInfo.memory && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Memory Used</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatMemory(systemInfo.memory.used)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Memory Total</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatMemory(systemInfo.memory.total)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={loadSystemInfo}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh System Info
              </button>
              
              <button
                onClick={loadSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Reload Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage