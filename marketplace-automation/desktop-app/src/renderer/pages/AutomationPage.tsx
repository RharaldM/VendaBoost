import { useState, useEffect } from 'react'
import { Upload, X, Play, Square, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ProductFormData {
  title: string
  price: string
  location: string
  description: string
  photos: File[]
  category: string
}

interface AutomationStatus {
  isRunning: boolean
  progress: number
  currentStep: string
  startTime: Date | null
  endTime: Date | null
  error?: string
}

const AutomationPage = () => {
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    price: '',
    location: '',
    description: '',
    photos: [],
    category: ''
  })
  
  const [status, setStatus] = useState<AutomationStatus>({
    isRunning: false,
    progress: 0,
    currentStep: 'Idle',
    startTime: null,
    endTime: null
  })
  
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    // Get initial automation status
    window.electronAPI?.getAutomationStatus().then(automationStatus => {
      setStatus(automationStatus)
    }).catch(() => {
      // Handle error silently
    })
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return
    
    const newFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error(`${file.name} is too large (max 10MB)`)
        return false
      }
      return true
    })
    
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...newFiles].slice(0, 10) // Max 10 photos
    }))
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }))
  }

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      toast.error('Title is required')
      return false
    }
    if (!formData.price.trim()) {
      toast.error('Price is required')
      return false
    }
    if (!formData.location.trim()) {
      toast.error('Location is required')
      return false
    }
    if (!formData.description.trim()) {
      toast.error('Description is required')
      return false
    }
    if (formData.photos.length === 0) {
      toast.error('At least one photo is required')
      return false
    }
    return true
  }

  const handleStartAutomation = async () => {
    if (!validateForm()) return
    
    try {
      // Convert files to paths for the main process
      const photoPaths = formData.photos.map(file => file.name || '')
      
      const productData = {
        ...formData,
        photos: photoPaths
      }
      
      const result = await window.electronAPI?.startAutomation(productData)
      
      if (result?.success) {
        toast.success('Automation started successfully')
        setStatus(prev => ({ ...prev, isRunning: true }))
      } else {
        toast.error(result?.error || 'Failed to start automation')
      }
    } catch (error) {
      toast.error('Failed to start automation')
      console.error('Automation error:', error)
    }
  }

  const handleStopAutomation = async () => {
    try {
      const result = await window.electronAPI?.stopAutomation()
      
      if (result?.success) {
        toast.success('Automation stopped')
        setStatus(prev => ({ ...prev, isRunning: false }))
      } else {
        toast.error(result?.error || 'Failed to stop automation')
      }
    } catch (error) {
      toast.error('Failed to stop automation')
      console.error('Stop automation error:', error)
    }
  }

  const categories = [
    'Electronics',
    'Vehicles',
    'Home & Garden',
    'Clothing & Accessories',
    'Sports & Recreation',
    'Entertainment',
    'Family',
    'Other'
  ]

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Listing</h1>
          <p className="text-gray-600">Automate your Facebook Marketplace listing creation</p>
        </div>

        {/* Status Bar */}
        {status.isRunning && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-blue-900">Automation Running</span>
              </div>
              <button
                onClick={handleStopAutomation}
                className="btn btn-outline text-red-600 border-red-300 hover:bg-red-50 px-3 py-1 text-sm"
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </button>
            </div>
            <div className="text-sm text-blue-800 mb-2">{status.currentStep}</div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {status.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-red-900">Automation Error</span>
            </div>
            <div className="text-sm text-red-800 mt-1">{status.error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="input w-full"
                    placeholder="Enter product title"
                    disabled={status.isRunning}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price *
                    </label>
                    <input
                      type="text"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="input w-full"
                      placeholder="$0.00"
                      disabled={status.isRunning}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="input w-full"
                      disabled={status.isRunning}
                    >
                      <option value="">Select category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location *
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="input w-full"
                    placeholder="Enter your location"
                    disabled={status.isRunning}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="textarea w-full"
                    placeholder="Describe your product..."
                    disabled={status.isRunning}
                  />
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos *</h2>
              
              {/* Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                } ${status.isRunning ? 'opacity-50 pointer-events-none' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Drag and drop photos here, or</p>
                <label className="btn btn-outline cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    disabled={status.isRunning}
                  />
                  Choose Files
                </label>
                <p className="text-xs text-gray-500 mt-2">Max 10 photos, 10MB each</p>
              </div>
              
              {/* Photo Preview */}
              {formData.photos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={status.isRunning}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview & Actions */}
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
              
              <div className="border border-gray-200 rounded-lg p-4">
                {formData.photos.length > 0 && (
                  <img
                    src={URL.createObjectURL(formData.photos[0])}
                    alt="Main preview"
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {formData.title || 'Product Title'}
                </h3>
                
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {formData.price || '$0.00'}
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  {formData.location || 'Location'}
                </div>
                
                <p className="text-gray-700 text-sm">
                  {formData.description || 'Product description will appear here...'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              
              <div className="space-y-4">
                <button
                  onClick={handleStartAutomation}
                  disabled={status.isRunning}
                  className="btn btn-primary w-full py-3 text-lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {status.isRunning ? 'Automation Running...' : 'Start Automation'}
                </button>
                
                <div className="text-xs text-gray-500 text-center">
                  This will automatically create your listing on Facebook Marketplace
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900 mb-1">Tips for Success</h3>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• Use clear, high-quality photos</li>
                    <li>• Write detailed descriptions</li>
                    <li>• Set competitive prices</li>
                    <li>• Include accurate location</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AutomationPage