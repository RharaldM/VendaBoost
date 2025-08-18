import React from 'react'
import { Link } from 'react-router-dom'
import { Bot, FileText, Settings, ArrowRight, Activity, Zap, Shield } from 'lucide-react'

const HomePage: React.FC = () => {
  const features = [
    {
      icon: Bot,
      title: 'Automated Posting',
      description: 'Automatically post products to Facebook Marketplace with intelligent form filling and validation.',
      color: 'text-blue-600'
    },
    {
      icon: Activity,
      title: 'Real-time Monitoring',
      description: 'Monitor automation progress with live logs and status updates via WebSocket connection.',
      color: 'text-green-600'
    },
    {
      icon: Zap,
      title: 'Fast & Efficient',
      description: 'Optimized automation engine with session persistence and intelligent error handling.',
      color: 'text-yellow-600'
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Built with security best practices and robust error handling for consistent performance.',
      color: 'text-purple-600'
    }
  ]

  const quickActions = [
    {
      title: 'Start Automation',
      description: 'Begin posting products to Facebook Marketplace',
      href: '/automation',
      icon: Bot,
      color: 'bg-brand hover:bg-brand-hover'
    },
    {
      title: 'View Logs',
      description: 'Monitor real-time automation logs and history',
      href: '/logs',
      icon: FileText,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      title: 'Settings',
      description: 'Configure automation preferences and options',
      href: '/settings',
      icon: Settings,
      color: 'bg-gray-600 hover:bg-gray-700'
    }
  ]

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-brand-light rounded-full">
            <Activity className="h-12 w-12 text-brand" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Marketplace Automation Portal
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
          Streamline your Facebook Marketplace posting process with intelligent automation, 
          real-time monitoring, and comprehensive logging capabilities.
        </p>
        <Link
          to="/automation"
          className="inline-flex items-center px-6 py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand-hover transition-colors duration-200"
        >
          Get Started
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <div key={index} className="card p-6 text-center hover:shadow-md transition-shadow duration-200">
              <div className="flex justify-center mb-4">
                <Icon className={`h-8 w-8 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {feature.description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <Link
                key={index}
                to={action.href}
                className={`block p-6 rounded-lg text-white transition-colors duration-200 ${action.color}`}
              >
                <div className="flex items-center mb-3">
                  <Icon className="h-6 w-6 mr-3" />
                  <h3 className="text-lg font-semibold">
                    {action.title}
                  </h3>
                </div>
                <p className="text-white/90 text-sm">
                  {action.description}
                </p>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            System Status
          </h3>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-green-600 font-medium">Online</span>
          </div>
        </div>
        
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Automation Status
          </h3>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
            <span className="text-gray-600 font-medium">Idle</span>
          </div>
        </div>
        
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Last Activity
          </h3>
          <p className="text-gray-600">No recent activity</p>
        </div>
      </div>
    </div>
  )
}

export default HomePage