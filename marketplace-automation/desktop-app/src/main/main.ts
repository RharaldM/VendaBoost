import { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { AutomationService } from './automation/automationService'

const store = new Store()
const isDev = process.argv.includes('--dev')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let automationService: AutomationService | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      webSecurity: !isDev
    },
    icon: join(__dirname, '../../assets/icon.png'),
    show: false,
    titleBarStyle: 'default'
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3001')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    
    // Restore window state
    const windowState = store.get('windowState') as any
    if (windowState) {
      mainWindow?.setBounds(windowState)
      if (windowState.isMaximized) {
        mainWindow?.maximize()
      }
    }
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow?.hide()
      
      // Save window state
      if (mainWindow) {
        const bounds = mainWindow.getBounds()
        store.set('windowState', {
          ...bounds,
          isMaximized: mainWindow.isMaximized()
        })
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray(): void {
  tray = new Tray(join(__dirname, '../../assets/tray-icon.png'))
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow?.show()
      }
    },
    {
      label: 'Hide App',
      click: () => {
        mainWindow?.hide()
      }
    },
    { type: 'separator' },
    {
      label: 'Start Automation',
      click: () => {
        mainWindow?.webContents.send('start-automation')
      }
    },
    {
      label: 'Stop Automation',
      click: () => {
        mainWindow?.webContents.send('stop-automation')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true
        app.quit()
      }
    }
  ])
  
  tray.setToolTip('Marketplace Automation')
  tray.setContextMenu(contextMenu)
  
  tray.on('double-click', () => {
    mainWindow?.show()
  })
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Automation',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('new-automation')
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('open-settings')
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.isQuiting = true
            app.quit()
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Automation',
      submenu: [
        {
          label: 'Start',
          accelerator: 'F5',
          click: () => {
            mainWindow?.webContents.send('start-automation')
          }
        },
        {
          label: 'Stop',
          accelerator: 'F6',
          click: () => {
            mainWindow?.webContents.send('stop-automation')
          }
        },
        { type: 'separator' },
        {
          label: 'View Logs',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow?.webContents.send('view-logs')
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About',
              message: 'Marketplace Automation',
              detail: 'Version 1.0.0\nAutomated Facebook Marketplace posting'
            })
          }
        },
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://github.com/marketplace-automation')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// App event listeners
app.whenReady().then(() => {
  createWindow()
  createTray()
  createMenu()
  
  // Initialize automation service
  automationService = new AutomationService()
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuiting = true
})

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-store-value', (_, key: string) => {
  return store.get(key)
})

ipcMain.handle('set-store-value', (_, key: string, value: any) => {
  store.set(key, value)
})

ipcMain.handle('start-automation', async (_, productData: any) => {
  try {
    if (automationService) {
      const result = await automationService.startAutomation(productData)
      return { success: true, data: result }
    }
    return { success: false, error: 'Automation service not available' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('stop-automation', async () => {
  try {
    if (automationService) {
      await automationService.stopAutomation()
      return { success: true }
    }
    return { success: false, error: 'Automation service not available' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('get-automation-status', () => {
  if (automationService) {
    return automationService.getStatus()
  }
  return { isRunning: false, progress: 0, currentStep: '', error: undefined }
})

// Extend app with custom properties
declare global {
  namespace Electron {
    interface App {
      isQuiting?: boolean
    }
  }
}