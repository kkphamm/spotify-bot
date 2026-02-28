import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Settings from './pages/Settings'
import ConnectedPlaylists from './pages/ConnectedPlaylists'
import PillOverlay from './pages/PillOverlay'
import { apiUrl } from './api'

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

  useEffect(() => {
    fetch(apiUrl('me'))
      .then((res) => {
        if (res.status === 401) {
          setAuthStatus('unauthenticated')
          window.location.href = apiUrl('auth')
        } else {
          setAuthStatus('authenticated')
        }
      })
      .catch(() => setAuthStatus('authenticated'))
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

  return (
    <div className="flex h-screen bg-[#121212] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[#121212]">
        <Outlet />
      </main>
    </div>
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
