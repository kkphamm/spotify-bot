import { useState, useEffect } from 'react'
import { apiUrl } from '../api'

export default function FeatureGrid() {
  const [authStatus, setAuthStatus] = useState(null)  // true | false | null (loading)
  const [devices, setDevices] = useState([])
  const [devicesLoading, setDevicesLoading] = useState(true)

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
