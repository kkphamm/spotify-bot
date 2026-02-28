const { app, BrowserWindow, Tray, nativeImage, Menu, ipcMain, Notification, session, screen } = require('electron')
const path = require('path')
const { uIOhook, UiohookKey } = require('uiohook-napi')

let mainWindow = null
let overlayWindow = null
let tray = null
let isHotkeyDown = false
let overlayEnabled = true

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const WINDOW_WIDTH = 576
const WINDOW_HEIGHT = 640

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 490,
    minHeight: 500,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png')
  let trayIcon = nativeImage.createFromPath(iconPath)
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0ABYBw1gGE0DBhGwwCIBhIGo2EwGgajYTAaBgMAxxkHARkYVpcAAAAASUVORK5CYII=')
  } else {
    trayIcon = trayIcon.resize({ width: 16, height: 16 })
  }
  tray = new Tray(trayIcon)

  tray.setToolTip('AI Music Assistant')
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show', click: () => { mainWindow?.show(); mainWindow?.focus() } },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } },
    ])
  )
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 200,
    height: 48,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const winWidth = 200
  const winHeight = 48
  const x = Math.round((width - winWidth) / 2)
  const y = Math.round(height - 120)
  overlayWindow.setBounds({ x, y, width: winWidth, height: winHeight })
  overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/overlay' })
}

function registerHoldToTalkHotkey() {
  const pressedKeys = new Set()

  uIOhook.on('keydown', (e) => {
    pressedKeys.add(e.keycode)

    const hasSpace = pressedKeys.has(UiohookKey.Space)
    const hasCtrl = pressedKeys.has(UiohookKey.Ctrl) || pressedKeys.has(UiohookKey.CtrlRight)
    const hasShift = pressedKeys.has(UiohookKey.Shift) || pressedKeys.has(UiohookKey.ShiftRight)

    if (hasSpace && hasCtrl && hasShift && !isHotkeyDown) {
      isHotkeyDown = true
      console.log('hotkey-down: Ctrl+Shift+Space')
      if (overlayEnabled && overlayWindow && !overlayWindow.isVisible()) {
        overlayWindow.showInactive()
        overlayWindow.webContents.send('overlay-shown')
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-down')
      }
    }
  })

  uIOhook.on('keyup', (e) => {
    pressedKeys.delete(e.keycode)

    if (isHotkeyDown) {
      const hasSpace = pressedKeys.has(UiohookKey.Space)
      const hasCtrl = pressedKeys.has(UiohookKey.Ctrl) || pressedKeys.has(UiohookKey.CtrlRight)
      const hasShift = pressedKeys.has(UiohookKey.Shift) || pressedKeys.has(UiohookKey.ShiftRight)

      const missingSpace = !hasSpace
      const missingBothCtrls = !hasCtrl
      const missingBothShifts = !hasShift

      if (missingSpace || missingBothCtrls || missingBothShifts) {
        isHotkeyDown = false
        console.log('hotkey-up: Ctrl+Shift+Space released')
        if (overlayEnabled && overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('audio-data', Array(10).fill(4))
          if (overlayWindow.isVisible()) overlayWindow.hide()
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('hotkey-up')
        }
      }
    }
  })

  uIOhook.start()
}

function showCommandToast(resolvedAction) {
  if (!resolvedAction || typeof resolvedAction !== 'string') return
  if (!Notification.isSupported()) return
  const iconPath = path.join(__dirname, '../public/icon.png')
  const opts = { title: 'AI Assistant', body: resolvedAction }
  try {
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) opts.icon = iconPath
  } catch (_) {}
  const notification = new Notification(opts)
  notification.show()
}

function registerIpcHandlers() {
  ipcMain.on('command-processed', (_event, resolvedAction) => {
    showCommandToast(resolvedAction)
  })
  ipcMain.on('log-to-terminal', (_event, message) => {
    console.log(message)
  })
  ipcMain.on('audio-data', (_event, data) => {
    if (overlayEnabled && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('audio-data', data)
    }
  })
  ipcMain.on('set-overlay-enabled', (_event, enabled) => {
    overlayEnabled = !!enabled
    if (!overlayEnabled && overlayWindow && overlayWindow.isVisible()) {
      overlayWindow.hide()
    }
  })
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => permission === 'media')

  createWindow()
  createOverlayWindow()
  createTray()
  registerHoldToTalkHotkey()
  registerIpcHandlers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  try {
    uIOhook.stop()
  } catch (_) {}
})
