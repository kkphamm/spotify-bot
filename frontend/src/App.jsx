import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Settings from './pages/Settings'
import PillOverlay from './pages/PillOverlay'

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
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
