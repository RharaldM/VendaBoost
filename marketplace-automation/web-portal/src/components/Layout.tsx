import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Bot, FileText, Settings, Activity } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Automation', href: '/automation', icon: Bot },
    { name: 'Logs', href: '/logs', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-brand mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Marketplace Automation
              </h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'text-brand bg-brand-light'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden bg-white border-b border-gray-200">
        <div className="px-4 py-2">
          <div className="flex space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex-1 flex flex-col items-center px-2 py-2 text-xs font-medium rounded-md transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-brand bg-brand-light'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

export default Layout