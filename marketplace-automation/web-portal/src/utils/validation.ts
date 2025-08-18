import { ProductFormData, ValidationErrors } from '../types'

export const validateForm = (data: ProductFormData): ValidationErrors => {
  const errors: ValidationErrors = {}

  // Title validation
  if (!data.title.trim()) {
    errors.title = 'Product title is required'
  } else if (data.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters long'
  } else if (data.title.trim().length > 100) {
    errors.title = 'Title must be less than 100 characters'
  }

  // Price validation
  if (!data.price.trim()) {
    errors.price = 'Price is required'
  } else {
    // Remove currency symbols and whitespace for validation
    const cleanPrice = data.price.replace(/[$,\s]/g, '')
    const priceNumber = parseFloat(cleanPrice)
    
    if (isNaN(priceNumber)) {
      errors.price = 'Please enter a valid price'
    } else if (priceNumber <= 0) {
      errors.price = 'Price must be greater than 0'
    } else if (priceNumber > 999999) {
      errors.price = 'Price must be less than $999,999'
    }
  }

  // Location validation
  if (!data.location.trim()) {
    errors.location = 'Location is required'
  } else if (data.location.trim().length < 2) {
    errors.location = 'Location must be at least 2 characters long'
  } else if (data.location.trim().length > 100) {
    errors.location = 'Location must be less than 100 characters'
  }

  // Description validation
  if (!data.description.trim()) {
    errors.description = 'Description is required'
  } else if (data.description.trim().length < 10) {
    errors.description = 'Description must be at least 10 characters long'
  } else if (data.description.trim().length > 500) {
    errors.description = 'Description must be less than 500 characters'
  }

  // Photo validation
  if (!data.photo) {
    errors.photo = 'Product photo is required'
  } else {
    // File size validation (10MB limit)
    if (data.photo.size > 10 * 1024 * 1024) {
      errors.photo = 'File size must be less than 10MB'
    }
    
    // File type validation
    if (!data.photo.type.startsWith('image/')) {
      errors.photo = 'Please select a valid image file'
    }
  }

  return errors
}

export const validateField = (name: keyof ProductFormData, value: string | File | null): string | undefined => {
  const tempData: ProductFormData = {
    title: '',
    price: '',
    location: '',
    description: '',
    photo: null
  }
  
  tempData[name] = value as any
  const errors = validateForm(tempData)
  return errors[name]
}

export const formatPrice = (price: string): string => {
  // Remove non-numeric characters except decimal point
  const cleanPrice = price.replace(/[^\d.]/g, '')
  
  // Parse as number and format
  const priceNumber = parseFloat(cleanPrice)
  
  if (isNaN(priceNumber)) {
    return ''
  }
  
  // Format with currency symbol
  return `$${priceNumber.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>"'&]/g, '')
}