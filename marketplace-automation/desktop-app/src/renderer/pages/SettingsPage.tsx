import { useState, useEffect } from 'react'
import { Save, Eye, EyeOff, TestTube, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Settings {
  facebook: {
    email: string
    password: string
    rememberLogin: boolean
  }
  automation: {
    delayBetweenActions: number
    maxRetries: number
    screenshotOnError: boolean
    headlessMode: boolean
  }
  notifications: {
    showDesktopNotifications: boolean
    playSound: boolean
    emailNotifications: boolean
    emailAddress: string
  }
  advanced: {
    logLevel: 'error' | 'warn' | 'info' | 'debug'
    autoStartOnBoot: boolean
    minimizeToTray: boolean
    autoUpdate: boolean
  }
}

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings>({
    facebook: {
      email: '',
      password: '',
      rememberLogin: true
    },
    automation: {
      delayBetweenActions: 2000,
      maxRetries: 3,
      screenshotOnError: true,
      headlessMode: false
    },
    notifications: {
      showDesktopNotifications: true,
      playSound: true,
      emailNotifications: false,
      emailAddress: ''
    },
    advanced: {
      logLevel: 'info',
      autoStartOnBoot: false,
      minimizeToTray: true,
      autoUpdate: true
    }
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const savedSettings = await window.electronAPI?.getSettings()
      if (savedSettings) {
        setSettings(savedSettings)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings')
    }
  }

  const handleInputChange = (section: keyof Settings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const result = await window.electronAPI?.saveSettings(settings)
      
      if (result?.success) {
        toast.success('Settings saved successfully')
        setHasUnsavedChanges(false)
      } else {
        toast.error(result?.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const testFacebookConnection = async () => {
    if (!settings.facebook.email || !settings.facebook.password) {
      toast.error('Please enter Facebook credentials first')
      return
    }

    try {
      setIsTestingConnection(true)
      setConnectionStatus('idle')
      
      const result = await window.electronAPI?.testFacebookConnection({
        email: settings.facebook.email,
        password: settings.facebook.password
      })
      
      if (result?.success) {
        setConnectionStatus('success')
        toast.success('Facebook connection successful')
      } else {
        setConnectionStatus('error')
        toast.error(result?.error || 'Facebook connection failed')
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      setConnectionStatus('error')
      toast.error('Connection test failed')
    } finally {
      setIsTestingConnection(false)
    }
  }

  const resetToDefaults = () => {
    const defaultSettings: Settings = {
      facebook: {
        email: '',
        password: '',
        rememberLogin: true
      },
      automation: {
        delayBetweenActions: 2000,
        maxRetries: 3,
        screenshotOnError: true,
        headlessMode: false
      },
      notifications: {
        showDesktopNotifications: true,
        playSound: true,
        emailNotifications: false,
        emailAddress: ''
      },
      advanced: {
        logLevel: 'info',
        autoStartOnBoot: false,
        minimizeToTray: true,
        autoUpdate: true
      }
    }
    
    setSettings(defaultSettings)
    setHasUnsavedChanges(true)
    toast.success('Settings reset to defaults')
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Configure your application preferences and automation settings</p>
        </div>

        {/* Save Bar */}
        {hasUnsavedChanges && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">You have unsaved changes</span>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* Facebook Account */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Facebook Account</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={settings.facebook.email}
                  onChange={(e) => handleInputChange('facebook', 'email', e.target.value)}
                  className="input w-full"
                  placeholder="your.email@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={settings.facebook.password}
                    onChange={(e) => handleInputChange('facebook', 'password', e.target.value)}
                    className="input w-full pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.facebook.rememberLogin}
                    onChange={(e) => handleInputChange('facebook', 'rememberLogin', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Remember login credentials</span>
                </label>
                
                <button
                  onClick={testFacebookConnection}
                  disabled={isTestingConnection || !settings.facebook.email || !settings.facebook.password}
                  className="btn btn-outline"
                >
                  {isTestingConnection ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  Test Connection
                </button>
              </div>
              
              {connectionStatus !== 'idle' && (
                <div className={`flex items-center space-x-2 text-sm ${
                  connectionStatus === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {connectionStatus === 'success' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span>
                    {connectionStatus === 'success' 
                      ? 'Connection successful' 
                      : 'Connection failed'
                    }
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Automation Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Automation Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delay Between Actions (ms)
                </label>
                <input
                  type="number"
                  min="500"
                  max="10000"
                  step="500"
                  value={settings.automation.delayBetweenActions}
                  onChange={(e) => handleInputChange('automation', 'delayBetweenActions', parseInt(e.target.value))}
                  className="input w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 2000ms</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Retries
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.automation.maxRetries}
                  onChange={(e) => handleInputChange('automation', 'maxRetries', parseInt(e.target.value))}
                  className="input w-full"
                />
              </div>
              
              <div className="md:col-span-2 space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.automation.screenshotOnError}
                    onChange={(e) => handleInputChange('automation', 'screenshotOnError', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Take screenshot on errors</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.automation.headlessMode}
                    onChange={(e) => handleInputChange('automation', 'headlessMode', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Run in headless mode (no browser window)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.notifications.showDesktopNotifications}
                  onChange={(e) => handleInputChange('notifications', 'showDesktopNotifications', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show desktop notifications</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.notifications.playSound}
                  onChange={(e) => handleInputChange('notifications', 'playSound', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Play notification sounds</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.notifications.emailNotifications}
                  onChange={(e) => handleInputChange('notifications', 'emailNotifications', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Send email notifications</span>
              </label>
              
              {settings.notifications.emailNotifications && (
                <div className="ml-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.notifications.emailAddress}
                    onChange={(e) => handleInputChange('notifications', 'emailAddress', e.target.value)}
                    className="input w-full max-w-md"
                    placeholder="notifications@example.com"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Log Level
                </label>
                <select
                  value={settings.advanced.logLevel}
                  onChange={(e) => handleInputChange('advanced', 'logLevel', e.target.value)}
                  className="input w-full"
                >
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.advanced.autoStartOnBoot}
                    onChange={(e) => handleInputChange('advanced', 'autoStartOnBoot', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Start automatically on boot</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.advanced.minimizeToTray}
                    onChange={(e) => handleInputChange('advanced', 'minimizeToTray', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Minimize to system tray</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.advanced.autoUpdate}
                    onChange={(e) => handleInputChange('advanced', 'autoUpdate', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Automatically check for updates</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className="btn btn-primary"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Settings
              </button>
              
              <button
                onClick={resetToDefaults}
                className="btn btn-outline"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage