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
  isElectron: true,
})
