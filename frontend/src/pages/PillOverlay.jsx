import { useEffect, useRef, useState } from 'react'

const BAR_COUNT = 10
const MAX_BAR = 14

function normalizeBars(data) {
  if (!Array.isArray(data) || data.length === 0) return Array(BAR_COUNT).fill(4)
  const out = data.slice(0, BAR_COUNT)
  while (out.length < BAR_COUNT) out.push(4)
  return out.map((v) => (v <= 30 ? v : Math.max(4, Math.max(0, (v - 30) / 225) * 24)))
}

export default function PillOverlay() {
  const [audioData, setAudioData] = useState(() => Array(BAR_COUNT).fill(4))
  const [expanded, setExpanded] = useState(false)
  const pendingRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    if (root) root.style.background = 'transparent'
    return () => {
      html.style.background = ''
      body.style.background = ''
      if (root) root.style.background = ''
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.onOverlayShown) return
    const unsubscribe = window.electronAPI.onOverlayShown(() => setExpanded(true))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.onAudioData) return
    const onData = (data) => {
      const normalized = normalizeBars(Array.isArray(data) ? data : (data?.data ?? []))
      pendingRef.current = normalized
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (pendingRef.current) {
          setAudioData(pendingRef.current)
        }
      })
    }
    const unsubscribe = window.electronAPI.onAudioData(onData)
    return () => {
      unsubscribe?.()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div id="overlay-root" className="w-full h-full bg-transparent flex items-center justify-center pointer-events-none outline-none">
      <div
        className={`bg-[#181818]/95 rounded-full border border-[#282828] h-9 flex items-center justify-center shadow-xl overflow-hidden ${
          expanded ? 'w-40 px-3 gap-2' : 'w-9 p-0'
        }`}
      >
        {/* Spotify logo */}
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 fill-[#1DB954]" aria-hidden>
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
        {/* Audio bars - centered, grow up and down from middle */}
        <div
          className={`flex items-center gap-0.5 h-5 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
        >
          {audioData.map((value, i) => {
            const h = Math.max(2, Math.min(MAX_BAR, value))
            const scale = h / MAX_BAR
            return (
              <div
                key={i}
                className="w-1 rounded-full bg-[#1DB954] shrink-0 origin-center will-change-transform"
                style={{
                  height: MAX_BAR,
                  transform: `scaleY(${scale})`,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
