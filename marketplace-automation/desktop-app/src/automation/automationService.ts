import puppeteer, { Browser, Page } from 'puppeteer'
import { EventEmitter } from 'events'
import Store from 'electron-store'

interface ProductData {
  title: string
  price: string
  location: string
  description: string
  photos: string[]
  category?: string
}

interface AutomationStatus {
  isRunning: boolean
  progress: number
  currentStep: string
  startTime: Date | null
  endTime: Date | null
  error?: string
}

export class AutomationService extends EventEmitter {
  private browser: Browser | null = null
  private page: Page | null = null
  private store: Store
  private status: AutomationStatus
  private abortController: AbortController | null = null

  constructor() {
    super()
    this.store = new Store()
    this.status = {
      isRunning: false,
      progress: 0,
      currentStep: 'Idle',
      startTime: null,
      endTime: null
    }
  }

  async startAutomation(productData: ProductData): Promise<void> {
    if (this.status.isRunning) {
      throw new Error('Automation is already running')
    }

    this.abortController = new AbortController()
    this.updateStatus({
      isRunning: true,
      progress: 0,
      currentStep: 'Initializing browser...',
      startTime: new Date(),
      endTime: null,
      error: undefined
    })

    try {
      await this.initializeBrowser()
      await this.loginToFacebook()
      await this.navigateToMarketplace()
      await this.createListing(productData)
      
      this.updateStatus({
        isRunning: false,
        progress: 100,
        currentStep: 'Completed successfully',
        endTime: new Date()
      })
      
      this.emit('automation-completed', { success: true })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.updateStatus({
        isRunning: false,
        currentStep: 'Failed',
        endTime: new Date(),
        error: errorMessage
      })
      
      this.emit('automation-failed', { error: errorMessage })
      throw error
    } finally {
      await this.cleanup()
    }
  }

  async stopAutomation(): Promise<void> {
    if (!this.status.isRunning) {
      return
    }

    this.abortController?.abort()
    
    this.updateStatus({
      isRunning: false,
      currentStep: 'Stopped by user',
      endTime: new Date()
    })

    await this.cleanup()
    this.emit('automation-stopped')
  }

  getStatus(): AutomationStatus {
    return { ...this.status }
  }

  private async initializeBrowser(): Promise<void> {
    this.updateStatus({ currentStep: 'Launching browser...', progress: 10 })
    
    const settings = this.store.get('settings', {}) as any
    const browserOptions = {
      headless: settings.automation?.headless ?? false,
      slowMo: settings.automation?.slowMo ?? 100,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }

    this.browser = await puppeteer.launch(browserOptions)
    this.page = await this.browser.newPage()
    
    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    
    // Set viewport
    await this.page.setViewport({ width: 1366, height: 768 })
    
    this.updateStatus({ currentStep: 'Browser initialized', progress: 20 })
  }

  private async loginToFacebook(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized')
    
    this.updateStatus({ currentStep: 'Navigating to Facebook...', progress: 25 })
    
    // Check if already logged in
    const sessionData = this.store.get('facebookSession') as any
    if (sessionData && sessionData.cookies) {
      await this.page.setCookie(...sessionData.cookies)
    }
    
    await this.page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' })
    
    // Check if already logged in
    const isLoggedIn = await this.page.$('[data-testid="royal_login_form"]') === null
    
    if (!isLoggedIn) {
      this.updateStatus({ currentStep: 'Logging into Facebook...', progress: 30 })
      
      const credentials = this.store.get('facebookCredentials') as any
      if (!credentials || !credentials.email || !credentials.password) {
        throw new Error('Facebook credentials not configured')
      }
      
      // Fill login form
      await this.page.type('#email', credentials.email)
      await this.page.type('#pass', credentials.password)
      
      // Click login button
      await this.page.click('[name="login"]')
      
      // Wait for navigation
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
      
      // Save session
      const cookies = await this.page.cookies()
      this.store.set('facebookSession', { cookies, timestamp: Date.now() })
    }
    
    this.updateStatus({ currentStep: 'Logged into Facebook', progress: 40 })
  }

  private async navigateToMarketplace(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized')
    
    this.updateStatus({ currentStep: 'Navigating to Marketplace...', progress: 50 })
    
    await this.page.goto('https://www.facebook.com/marketplace/create/item', {
      waitUntil: 'networkidle2'
    })
    
    // Wait for the create listing form to load
    await this.page.waitForSelector('[data-testid="marketplace-composer-title-input"]', {
      timeout: 15000
    })
    
    this.updateStatus({ currentStep: 'Marketplace loaded', progress: 60 })
  }

  private async createListing(productData: ProductData): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized')
    
    this.updateStatus({ currentStep: 'Creating listing...', progress: 65 })
    
    // Upload photos first
    if (productData.photos && productData.photos.length > 0) {
      this.updateStatus({ currentStep: 'Uploading photos...', progress: 70 })
      
      const photoInput = await this.page.$('input[type="file"][accept*="image"]')
      if (photoInput) {
        await photoInput.uploadFile(...productData.photos)
        
        // Wait for photos to upload
        await this.page.waitForTimeout(3000)
      }
    }
    
    // Fill title
    this.updateStatus({ currentStep: 'Filling product details...', progress: 75 })
    
    const titleInput = await this.page.$('[data-testid="marketplace-composer-title-input"]')
    if (titleInput) {
      await titleInput.click()
      await titleInput.type(productData.title)
    }
    
    // Fill price
    const priceInput = await this.page.$('[data-testid="marketplace-composer-price-input"]')
    if (priceInput) {
      await priceInput.click()
      await priceInput.type(productData.price)
    }
    
    // Fill location
    const locationInput = await this.page.$('[data-testid="marketplace-composer-location-input"]')
    if (locationInput) {
      await locationInput.click()
      await locationInput.type(productData.location)
      
      // Wait for location suggestions and select first one
      await this.page.waitForTimeout(2000)
      const firstSuggestion = await this.page.$('[role="option"]')
      if (firstSuggestion) {
        await firstSuggestion.click()
      }
    }
    
    // Fill description
    const descriptionInput = await this.page.$('[data-testid="marketplace-composer-description-input"]')
    if (descriptionInput) {
      await descriptionInput.click()
      await descriptionInput.type(productData.description)
    }
    
    this.updateStatus({ currentStep: 'Publishing listing...', progress: 90 })
    
    // Click publish button
    const publishButton = await this.page.$('[data-testid="marketplace-composer-publish-button"]')
    if (publishButton) {
      await publishButton.click()
      
      // Wait for success confirmation
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    }
    
    this.updateStatus({ currentStep: 'Listing published successfully', progress: 95 })
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close()
        this.page = null
      }
      
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  private updateStatus(updates: Partial<AutomationStatus>): void {
    this.status = { ...this.status, ...updates }
    this.emit('status-updated', this.status)
  }

  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Automation was aborted')
    }
  }
}