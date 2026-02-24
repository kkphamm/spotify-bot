import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import TopTracks from './pages/TopTracks'
import VoiceControl from './pages/VoiceControl'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[#121212] overflow-hidden">
        <Sidebar />

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto bg-[#121212]">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/top-tracks" element={<TopTracks />} />
            <Route path="/voice" element={<VoiceControl />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
