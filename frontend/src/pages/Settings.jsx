import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pillOverlayEnabled'

export default function Settings() {
  const [overlayEnabled, setOverlayEnabledState] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const val = stored === null ? true : stored === 'true'
      setOverlayEnabledState(val)
      if (window.electronAPI?.setOverlayEnabled) {
        window.electronAPI.setOverlayEnabled(val)
      }
    } catch (_) {
      // ignore
    }
  }, [])

  function handleOverlayToggle(enabled) {
    setOverlayEnabledState(enabled)
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch (_) {}
    if (window.electronAPI?.setOverlayEnabled) {
      window.electronAPI.setOverlayEnabled(enabled)
    }
  }

  return (
    <div className="min-h-full px-4 sm:px-8 py-6">
      <h1 className="text-white font-bold text-xl sm:text-2xl mb-6">Settings</h1>
      <div className="space-y-4 max-w-md">
        <label className="flex items-center justify-between gap-4 p-4 rounded-lg bg-[#181818] hover:bg-[#282828] transition-colors cursor-pointer">
          <span className="text-white font-medium">Show pill overlay when speaking</span>
          <input
            type="checkbox"
            checked={overlayEnabled}
            onChange={(e) => handleOverlayToggle(e.target.checked)}
            className="w-4 h-4 rounded border-[#535353] bg-[#282828] text-[#1DB954] focus:ring-[#1DB954] focus:ring-offset-0"
          />
        </label>
        <p className="text-[#b3b3b3] text-sm">
          When enabled, a small pill appears in the bottom-right corner while you hold Ctrl+Shift+Space to speak.
        </p>
      </div>
    </div>
  )
}
