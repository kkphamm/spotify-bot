import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import VoiceAssistant from './components/VoiceAssistant'
import Home from './pages/Home'
import Settings from './pages/Settings'
import ConnectedPlaylists from './pages/ConnectedPlaylists'
import PillOverlay from './pages/PillOverlay'
import { PlaylistsProvider } from './contexts/PlaylistsContext'
import { UserProvider } from './contexts/UserContext'
import { apiUrl, signInToSpotify } from './api'

const STORAGE_KEY = 'pillOverlayEnabled'

function SettingsSync() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.setOverlayEnabled) return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const val = stored === null ? true : stored === 'true'
      window.electronAPI.setOverlayEnabled(val)
    } catch (_) {}
  }, [])
  return null
}

function MainLayout() {
  const [authStatus, setAuthStatus] = useState('checking')
  const [user, setUser] = useState(null)

  useEffect(() => {
    async function checkSpotify() {
      try {
        const response = await fetch(apiUrl('me'))
        if (response.status === 401) {
          setUser(null)
          setAuthStatus('unauthenticated')
          if (!window.electronAPI) signInToSpotify()
          return
        }
        if (response.ok) setUser(await response.json())
      } catch {
        // Show the app so the user can retry if the backend is unavailable.
      }
      setAuthStatus('authenticated')
    }

    checkSpotify()
    if (window.electronAPI) window.addEventListener('focus', checkSpotify)
    return () => window.removeEventListener('focus', checkSpotify)
  }, [])

  if (authStatus === 'checking') {
    return (
      <div className="flex h-screen bg-[#121212] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#b3b3b3]">
          <div className="w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Checking Spotify…</p>
        </div>
      </div>
    )
  }

  if (authStatus === 'unauthenticated' && window.electronAPI) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#121212] px-6 text-center text-white">
        <h1 className="text-xl font-semibold">Connect Spotify</h1>
        <p className="text-sm text-[#b3b3b3]">Sign in in your browser, then return to Spotify Bot.</p>
        <button type="button" onClick={signInToSpotify} className="rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#1ed760]">
          Sign in to Spotify
        </button>
      </main>
    )
  }

  return (
    <UserProvider user={user}>
      <PlaylistsProvider>
        <div className="flex h-screen bg-[#121212] overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-[#121212]">
            <Outlet />
          </main>
          {/* Always mounted so hotkey + overlay audio work on Playlists/Settings too */}
          <VoiceAssistant />
        </div>
      </PlaylistsProvider>
    </UserProvider>
  )
}

export default function App() {
  return (
    <HashRouter>
      <SettingsSync />
      <Routes>
        {/* Standalone transparent route */}
        <Route path="/overlay" element={<PillOverlay />} />

        {/* Standard app routes with Sidebar */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/playlists" element={<ConnectedPlaylists />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
