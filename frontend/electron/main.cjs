const { app, BrowserWindow, Tray, nativeImage, Menu, ipcMain, Notification } = require('electron')
const path = require('path')
const { uIOhook, UiohookKey } = require('uiohook-napi')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let tray = null
let altSDown = false

const WINDOW_WIDTH = 400
const WINDOW_HEIGHT = 640

function isAltS(event) {
  return event.keycode === UiohookKey.S && event.altKey
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 340,
    minHeight: 500,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
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

function registerHoldToTalkHotkey() {
  uIOhook.on('keydown', (e) => {
    if (!isAltS(e)) return
    if (altSDown) return // key repeat
    altSDown = true

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hotkey-down')
    }
  })

  uIOhook.on('keyup', (e) => {
    const isSWithAlt = e.keycode === UiohookKey.S && e.altKey
    const isAltKey = e.keycode === UiohookKey.Alt || e.keycode === UiohookKey.AltRight
    if (!altSDown) return
    if (!isSWithAlt && !isAltKey) return
    altSDown = false

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hotkey-up')
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
}

app.whenReady().then(() => {
  createWindow()
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
