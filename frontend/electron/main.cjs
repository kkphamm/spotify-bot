const { app, BrowserWindow, Tray, nativeImage, Menu, ipcMain, Notification, session } = require('electron')
const path = require('path')
const { uIOhook, UiohookKey } = require('uiohook-napi')

let mainWindow = null
let tray = null
let isHotkeyDown = false
let isCtrlDown = false
let isShiftDown = false

const WINDOW_WIDTH = 480
const WINDOW_HEIGHT = 640

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 408,
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

function registerHoldToTalkHotkey() {
  uIOhook.on('keydown', (e) => {
    console.log('uiohook keydown', e.keycode)

    // Track modifier state
    if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
      isCtrlDown = true
    }
    if (e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) {
      isShiftDown = true
    }

    // Fire hotkey when Ctrl + Shift + Space are all down
    if (e.keycode === UiohookKey.Space && isCtrlDown && isShiftDown) {
      if (isHotkeyDown) return // key repeat
      isHotkeyDown = true
      console.log('hotkey-down: Ctrl+Shift+Space')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-down')
      }
    }
  })

  uIOhook.on('keyup', (e) => {
    console.log('uiohook keyup', e.keycode)

    const isSpace = e.keycode === UiohookKey.Space
    const isCtrl = e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight
    const isShift = e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight

    // Reset modifier state
    if (isCtrl) isCtrlDown = false
    if (isShift) isShiftDown = false

    // Release hotkey if any of the three keys is lifted while hotkey was held
    if (isHotkeyDown && (isSpace || isCtrl || isShift)) {
      isHotkeyDown = false
      console.log('hotkey-up: Ctrl+Shift+Space released')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-up')
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
