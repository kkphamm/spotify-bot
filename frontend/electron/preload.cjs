const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onHotkeyDown: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('hotkey-down', handler)
    return () => ipcRenderer.removeListener('hotkey-down', handler)
  },
  onHotkeyUp: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('hotkey-up', handler)
    return () => ipcRenderer.removeListener('hotkey-up', handler)
  },
  sendCommandProcessed: (resolvedAction) => {
    ipcRenderer.send('command-processed', resolvedAction)
  },
  logToTerminal: (message) => ipcRenderer.send('log-to-terminal', message),
  sendAudioData: (data) => ipcRenderer.send('audio-data', data),
  setOverlayEnabled: (enabled) => ipcRenderer.send('set-overlay-enabled', enabled),
  onAudioData: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('audio-data', handler)
    return () => ipcRenderer.removeListener('audio-data', handler)
  },
  onOverlayShown: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('overlay-shown', handler)
    return () => ipcRenderer.removeListener('overlay-shown', handler)
  },
  isElectron: true,
})
