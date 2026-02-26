import { useState, useEffect } from 'react'
import { apiUrl } from '../api'

export default function FeatureGrid() {
  const [authStatus, setAuthStatus] = useState(null)  // true | false | null (loading)
  const [devices, setDevices] = useState([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [intentInput, setIntentInput] = useState('')
  const [intentResult, setIntentResult] = useState(null)
  const [intentLoading, setIntentLoading] = useState(false)
  const [intentError, setIntentError] = useState(null)

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(apiUrl('me'))
        setAuthStatus(res.ok)
      } catch {
        setAuthStatus(false)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    async function fetchDevices() {
      setDevicesLoading(true)
      try {
        const res = await fetch(apiUrl('devices'))
        const data = await res.json()
        setDevices(data.devices ?? [])
      } catch {
        setDevices([])
      } finally {
        setDevicesLoading(false)
      }
    }
    fetchDevices()
  }, [])

  async function handleIntentSubmit(e) {
    e.preventDefault()
    if (!intentInput.trim()) return
    setIntentLoading(true)
    setIntentError(null)
    setIntentResult(null)
    try {
        const res = await fetch(apiUrl('play'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: intentInput.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.detail?.[0] ?? res.statusText)
      setIntentResult(data)
      setIntentInput('')
    } catch (e) {
      setIntentError(e.message)
    } finally {
      setIntentLoading(false)
    }
  }

  const cards = [
    {
      title: 'Device Management',
      body: (
        <div className="space-y-2">
          {devicesLoading ? (
            <p className="text-[#535353] text-sm">Loading devices…</p>
          ) : devices.length === 0 ? (
            <p className="text-[#535353] text-sm">No active devices. Open Spotify.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {devices.map((d) => (
                <li
                  key={d.id ?? d.name}
                  className="flex items-center gap-2 text-white"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${d.is_active ? 'bg-[#1DB954]' : 'bg-[#535353]'}`} />
                  <span className="truncate">{d.name ?? 'Unknown'}</span>
                  {d.is_active && <span className="text-[#1DB954] text-xs">active</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    },
    {
      title: 'Intent Engine',
      body: (
        <form onSubmit={handleIntentSubmit} className="space-y-3">
          <input
            type="text"
            value={intentInput}
            onChange={(e) => setIntentInput(e.target.value)}
            placeholder="Type a command…"
            className="w-full bg-[#282828] text-white placeholder-[#535353] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1DB954] border border-[#404040]"
          />
          <button
            type="submit"
            disabled={intentLoading || !intentInput.trim()}
            className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-40 text-black font-bold py-2.5 rounded-lg text-sm transition-colors"
          >
            {intentLoading ? 'Sending…' : 'Send to Play'}
          </button>
          {intentError && (
            <p className="text-red-400 text-xs">{intentError}</p>
          )}
          {intentResult && (
            <p className="text-[#1DB954] text-xs font-medium">
              {intentResult.mode === 'track' && `${intentResult.track} — ${intentResult.artists?.join(', ')}`}
              {intentResult.mode === 'artist' && `Artist mix · ${intentResult.artist}`}
              {intentResult.mode === 'multi' && `${intentResult.track_count} tracks`}
            </p>
          )}
        </form>
      ),
    },
    {
      title: 'Auth Status',
      body: (
        <div className="flex items-center gap-3">
          <span
            className={`w-4 h-4 rounded-full shrink-0 ${
              authStatus === null ? 'bg-[#535353] animate-pulse' : authStatus ? 'bg-[#1DB954]' : 'bg-red-500'
            }`}
            aria-label={authStatus === null ? 'Checking…' : authStatus ? 'Connected' : 'Not connected'}
          />
          <span className="text-sm text-white">
            {authStatus === null ? 'Checking…' : authStatus ? 'Spotify OAuth active' : 'Not authenticated'}
          </span>
        </div>
      ),
    },
  ]

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      {cards.map(({ title, body }) => (
        <article
          key={title}
          className="bg-[#181818] rounded-lg sm:rounded-xl p-4 sm:p-5 border border-[#282828] hover:bg-[#1a1a1a] transition-colors"
        >
          <h3 className="text-white font-bold text-sm mb-3 sm:mb-4">{title}</h3>
          {body}
        </article>
      ))}
    </section>
  )
}
