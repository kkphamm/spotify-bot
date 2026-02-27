import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-screen bg-[#121212] overflow-hidden">
        <Sidebar />

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto bg-[#121212]">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
