import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import AutomationPage from './pages/AutomationPage'
import LogsPage from './pages/LogsPage'
import SettingsPage from './pages/SettingsPage'
import './index.css'

function AppContent() {
  const navigate = useNavigate()

  useEffect(() => {
    // Listen for menu actions from main process
    window.electronAPI?.onMenuAction((action: string) => {
      switch (action) {
        case 'new-automation':
        case 'start-automation':
          navigate('/automation')
          break
        case 'open-settings':
          navigate('/settings')
          break
        case 'view-logs':
          navigate('/logs')
          break
        case 'stop-automation':
          // Handle stop automation if needed
          break
      }
    })
  }, [navigate])

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
      <Toaster position="top-right" />
    </Router>
  )
}

export default App