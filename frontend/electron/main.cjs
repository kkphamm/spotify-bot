const { app, BrowserWindow, Tray, nativeImage, Menu, ipcMain, Notification, session, screen, dialog, shell, systemPreferences } = require('electron')
const { spawn } = require('node:child_process')
const { closeSync, openSync } = require('node:fs')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')
const { uIOhook, UiohookKey } = require('uiohook-napi')

let mainWindow = null
let overlayWindow = null
let tray = null
let isHotkeyDown = false
let mainWindowRevealedByHotkey = false
let overlayEnabled = true
let hotkeyRegistered = false
let backendProcess = null

const isMac = process.platform === 'darwin'
const backendOrigin = 'http://127.0.0.1:8000'
const WINDOW_WIDTH = 576
const WINDOW_HEIGHT = 640

async function backendIsReady() {
  try {
    const response = await fetch(`${backendOrigin}/health`, { signal: AbortSignal.timeout(750) })
    return response.ok && (await response.json()).app === 'AI Music Assistant'
  } catch {
    return false
  }
}

async function startLocalBackend() {
  if (!isMac || !app.isPackaged || await backendIsReady()) return
  const { backendProjectPath } = require('../package.json')
  if (!backendProjectPath) throw new Error('Build the local Mac app with npm run electron:build:mac.')

  const logPath = path.join(app.getPath('logs'), 'backend.log')
  const log = openSync(logPath, 'a', 0o600)
  let startupError
  try {
    backendProcess = spawn(path.join(backendProjectPath, '.venv/bin/python'), [
      '-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000', '--no-access-log',
    ], {
      cwd: backendProjectPath,
      env: { ...process.env, SPOTIFY_CACHE_PATH: process.env.SPOTIFY_CACHE_PATH || '.cache-spotify-bot' },
      stdio: ['ignore', log, log],
    })
    backendProcess.on('error', (error) => { startupError = error })
  } finally {
    closeSync(log)
  }

  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (startupError) throw startupError
    if (backendProcess.exitCode !== null || backendProcess.signalCode !== null) break
    if (await backendIsReady()) return
    await delay(200)
  }
  throw new Error(`The backend could not start. See ${logPath}.`)
}

function showMainWindow() {
  mainWindow?.show()
  mainWindow?.focus()
}

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

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
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
  tray.on('double-click', showMainWindow)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show', click: showMainWindow },
      { label: 'Quit', click: () => app.quit() },
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
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  // Keep overlay above other apps when main window is in background or minimized
  try {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } catch (_) {
    try { overlayWindow.setVisibleOnAllWorkspaces(true) } catch (_) {}
  }
  overlayWindow.setAlwaysOnTop(true, 'floating')
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

function registerHoldToTalkHotkey(promptForAccess = false) {
  if (hotkeyRegistered || (isMac && !systemPreferences.isTrustedAccessibilityClient(promptForAccess))) return
  const pressedKeys = new Set()
  const primaryKeys = isMac ? [UiohookKey.Meta, UiohookKey.MetaRight] : [UiohookKey.Ctrl, UiohookKey.CtrlRight]
  const isHeld = () => pressedKeys.has(UiohookKey.Space)
    && primaryKeys.some((key) => pressedKeys.has(key))
    && (pressedKeys.has(UiohookKey.Shift) || pressedKeys.has(UiohookKey.ShiftRight))

  uIOhook.on('keydown', (e) => {
    pressedKeys.add(e.keycode)

    if (isHeld() && !isHotkeyDown) {
      isHotkeyDown = true
      if (overlayEnabled && overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setAlwaysOnTop(true, 'floating')
        overlayWindow.showInactive()
        if (typeof overlayWindow.moveTop === 'function') overlayWindow.moveTop()
        overlayWindow.webContents.send('overlay-shown')
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Show main window inactive so mic/recording works when app was in tray
        if (!mainWindow.isVisible()) {
          mainWindowRevealedByHotkey = true
          mainWindow.showInactive()
        }
        mainWindow.webContents.send('hotkey-down')
      }
    }
  })

  uIOhook.on('keyup', (e) => {
    pressedKeys.delete(e.keycode)

    if (isHotkeyDown && !isHeld()) {
      isHotkeyDown = false
      if (overlayEnabled && overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('audio-data', Array(10).fill(4))
        if (overlayWindow.isVisible()) overlayWindow.hide()
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-up')
        if (mainWindowRevealedByHotkey) {
          if (mainWindow.isVisible() && !mainWindow.isFocused()) mainWindow.hide()
          mainWindowRevealedByHotkey = false
        }
      }
    }
  })

  uIOhook.start()
  hotkeyRegistered = true
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
  ipcMain.on('spotify-login', (event) => {
    if (event.sender !== mainWindow?.webContents) return
    shell.openExternal(`${backendOrigin}/auth?desktop=true`).catch(() => {
      dialog.showErrorBox('Spotify sign-in', 'The sign-in page could not be opened in your browser.')
    })
  })
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

const ownsInstance = app.requestSingleInstanceLock()
if (!ownsInstance) app.quit()
app.on('second-instance', showMainWindow)
app.on('activate', showMainWindow)
app.on('browser-window-focus', () => {
  if (isMac) registerHoldToTalkHotkey()
})

app.whenReady().then(async () => {
  if (!ownsInstance) return
  await startLocalBackend()
  const allowMedia = (contents, permission) => contents === mainWindow?.webContents && permission === 'media'
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(allowMedia(contents, permission)))
  session.defaultSession.setPermissionCheckHandler(allowMedia)

  registerIpcHandlers()
  createWindow()
  createOverlayWindow()
  createTray()
  registerHoldToTalkHotkey(true)
}).catch((error) => {
  dialog.showErrorBox('Spotify Bot could not start', error.message)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (hotkeyRegistered) uIOhook.stop()
  backendProcess?.kill()
})
