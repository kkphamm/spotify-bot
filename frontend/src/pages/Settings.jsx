import { useEffect, useState } from 'react'
import { apiUrl } from '../api'

const STORAGE_KEY = 'pillOverlayEnabled'

export default function Settings() {
  const [overlayEnabled, setOverlayEnabledState] = useState(true)
  const [loggedOut, setLoggedOut] = useState(false)

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

        <div className="pt-6 border-t border-[#282828]">
          <h2 className="text-white font-semibold text-base mb-2">Spotify</h2>
          <p className="text-[#b3b3b3] text-sm mb-4">
            Log out to clear your session. Next time you launch the app, you’ll be sent to Spotify to sign in again.
          </p>
          {loggedOut && (
            <p className="text-[#1DB954] text-sm mb-3">Logged out. Restart the app to sign in again.</p>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch(apiUrl('logout'), { method: 'POST' })
                setLoggedOut(true)
              } catch (_) {}
            }}
            className="px-4 py-2 rounded-full border border-[#535353] hover:bg-[#282828] text-[#b3b3b3] hover:text-white text-sm font-semibold transition-colors mr-3"
          >
            Log out
          </button>
          <p className="text-[#b3b3b3] text-sm mt-4">
            Re-authorize to grant new permissions (e.g. access to your playlists) without logging out.
          </p>
          <button
            type="button"
            onClick={() => { window.location.href = apiUrl('auth') }}
            className="px-4 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-sm font-semibold transition-colors mt-2"
          >
            Reauthorize Spotify
          </button>
        </div>
      </div>
    </div>
  )
}
