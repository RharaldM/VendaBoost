import { NavLink } from 'react-router-dom'
import { Home, Play, FileText, Settings, Activity } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SidebarProps {
  className?: string
}

const Sidebar = ({ className = '' }: SidebarProps) => {
  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    // Get app version from main process
    window.electronAPI?.getVersion().then((version: string) => {
      setAppVersion(version)
    }).catch(() => {
      setAppVersion('1.0.0')
    })
  }, [])

  const navItems = [
    {
      to: '/',
      icon: Home,
      label: 'Home',
      description: 'Dashboard overview'
    },
    {
      to: '/automation',
      icon: Play,
      label: 'Automation',
      description: 'Create listings'
    },
    {
      to: '/logs',
      icon: FileText,
      label: 'Logs',
      description: 'View activity logs'
    },
    {
      to: '/settings',
      icon: Settings,
      label: 'Settings',
      description: 'Configure app'
    }
  ]

  return (
    <div className={`w-64 bg-white border-r border-gray-200 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Marketplace</h1>
            <p className="text-sm text-gray-500">Automation</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors group ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Version {appVersion}
        </div>
        <div className="text-xs text-gray-400 text-center mt-1">
          Marketplace Automation
        </div>
      </div>
    </div>
  )
}

export default Sidebar