import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AutomationPage from './pages/AutomationPage'
import LogsPage from './pages/LogsPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton 
        duration={4000}
      />
    </div>
  )
}

export default App