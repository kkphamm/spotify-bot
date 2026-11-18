export const isMac = window.electronAPI?.isMac ?? navigator.platform.startsWith('Mac')
export const holdToTalkLabel = isMac ? '⌘⇧Space' : 'Ctrl+Shift+Space'
