import React, { useState, useRef } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ProductFormData, ValidationErrors, FileUploadInfo } from '../types'
import { validateForm } from '../utils/validation'
import { submitAutomation } from '../services/api'

const AutomationPage: React.FC = () => {
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    price: '',
    location: '',
    description: '',
    photo: null
  })
  
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fileInfo, setFileInfo] = useState<FileUploadInfo | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear error when user starts typing
    if (errors[name as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setErrors(prev => ({ ...prev, photo: 'File size must be less than 10MB' }))
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, photo: 'Please select a valid image file' }))
      return
    }

    setFormData(prev => ({ ...prev, photo: file }))
    setFileInfo({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    })
    setErrors(prev => ({ ...prev, photo: undefined }))
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const removeFile = () => {
    setFormData(prev => ({ ...prev, photo: null }))
    setFileInfo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm(formData)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      toast.error('Please fix the form errors before submitting')
      return
    }

    setIsSubmitting(true)
    setProgress(0)
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 10
        })
      }, 200)

      const result = await submitAutomation(formData)
      
      clearInterval(progressInterval)
      setProgress(100)
      
      if (result.success) {
        toast.success('Automation started successfully!')
        // Reset form
        setFormData({
          title: '',
          price: '',
          location: '',
          description: '',
          photo: null
        })
        setFileInfo(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        toast.error(result.message || 'Failed to start automation')
      }
    } catch (error) {
      toast.error('An error occurred while starting automation')
      console.error('Automation error:', error)
    } finally {
      setIsSubmitting(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  const isFormValid = () => {
    return formData.title && formData.price && formData.location && formData.description && formData.photo
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Facebook Marketplace Automation
        </h1>
        <p className="text-gray-600">
          Fill out the product information below to automatically post to Facebook Marketplace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-8 space-y-6">
        {/* Title Field */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Product Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className={`input ${errors.title ? 'input-error' : ''}`}
            placeholder="Enter product title"
            maxLength={100}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-error flex items-center animate-slide-in">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.title}
            </p>
          )}
        </div>

        {/* Price Field */}
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
            Price *
          </label>
          <input
            type="text"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            className={`input ${errors.price ? 'input-error' : ''}`}
            placeholder="Enter price (e.g., $100)"
          />
          {errors.price && (
            <p className="mt-1 text-sm text-error flex items-center animate-slide-in">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.price}
            </p>
          )}
        </div>

        {/* Location Field */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
            Location *
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            className={`input ${errors.location ? 'input-error' : ''}`}
            placeholder="Enter location"
          />
          {errors.location && (
            <p className="mt-1 text-sm text-error flex items-center animate-slide-in">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.location}
            </p>
          )}
        </div>

        {/* Description Field */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className={`input resize-none ${errors.description ? 'input-error' : ''}`}
            placeholder="Enter product description"
            maxLength={500}
          />
          <div className="mt-1 flex justify-between items-center">
            {errors.description ? (
              <p className="text-sm text-error flex items-center animate-slide-in">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.description}
              </p>
            ) : (
              <div></div>
            )}
            <span className="text-sm text-gray-500">
              {formData.description.length}/500
            </span>
          </div>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product Photo *
          </label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${
              isDragOver
                ? 'border-brand bg-brand-light'
                : errors.photo
                ? 'border-error bg-error-bg'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {fileInfo ? (
              <div className="animate-slide-in">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">{fileInfo.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(fileInfo.size)} • {fileInfo.type}
                  </p>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-error hover:text-red-700 transition-colors duration-200"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium text-brand">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>
            )}
          </div>
          {errors.photo && (
            <p className="mt-1 text-sm text-error flex items-center animate-slide-in">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.photo}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        {isSubmitting && (
          <div className="animate-slide-in">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Processing...</span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-brand transition-all duration-300 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid() || isSubmitting}
          className={`w-full btn btn-primary py-3 text-base font-medium ${
            !isFormValid() || isSubmitting
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-lg'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Starting Automation...
            </>
          ) : (
            'Start Automation'
          )}
        </button>
      </form>
    </div>
  )
}

export default AutomationPage