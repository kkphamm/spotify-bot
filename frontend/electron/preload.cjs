const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onHotkeyDown: (callback) => {
    ipcRenderer.on('hotkey-down', callback)
  },
  onHotkeyUp: (callback) => {
    ipcRenderer.on('hotkey-up', callback)
  },
  sendCommandProcessed: (resolvedAction) => {
    ipcRenderer.send('command-processed', resolvedAction)
  },
  isElectron: true,
})
