import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'

export default function TopTracks() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playingId, setPlayingId] = useState(null)

  useEffect(() => {
    fetch('/api/top-tracks?limit=10')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load top tracks')
        return r.json()
      })
      .then((data) => setTracks(data.tracks ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handlePlay(track) {
    const uri = track.uri || (track.id ? `spotify:track:${track.id}` : null)
    if (!uri) {
      setError('No track URI available')
      return
    }
    setPlayingId(track.id ?? track.name)
    try {
      const res = await fetch('/api/play-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.detail?.[0] ?? res.statusText)
    } catch (e) {
      setError(e.message)
    } finally {
      setPlayingId(null)
    }
  }

  function formatMs(ms) {
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const artistStr = (track) =>
    track.artists?.map((a) => a.name ?? a).join(', ') ?? '—'

  return (
    <div className="min-h-full">
      <div className="bg-gradient-to-b from-[#2a1a3e] to-[#121212] pb-8">
        <Topbar title="Your Top Tracks" />
      </div>

      <div className="px-8 py-6">
        {loading && (
          <div className="flex items-center gap-3 text-[#b3b3b3]">
            <div className="w-5 h-5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
            Loading your top tracks…
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
            {error} — make sure the backend is running and you're authenticated.
          </div>
        )}

        {!loading && !error && tracks.length === 0 && (
          <p className="text-[#b3b3b3]">No top tracks found. Try listening to more music on Spotify!</p>
        )}

        {tracks.length > 0 && (
          <ul className="space-y-1">
            {tracks.map((track, i) => {
              const img = track.album?.images?.[0]?.url
              const isPlaying = playingId === (track.id ?? track.name)

              return (
                <li
                  key={track.id ?? i}
                  className="flex items-center gap-4 px-4 py-3 rounded-md hover:bg-[#282828] group transition-colors duration-150"
                >
                  <span className="text-[#b3b3b3] w-6 text-right shrink-0 tabular-nums">
                    {i + 1}
                  </span>

                  {img ? (
                    <img
                      src={img}
                      alt={track.album?.name ?? ''}
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-[#282828] shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#535353]">
                        <path d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z" />
                      </svg>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{track.name}</p>
                    <p className="text-[#b3b3b3] text-sm truncate">{artistStr(track)}</p>
                  </div>

                  <span className="text-[#b3b3b3] text-sm tabular-nums shrink-0">
                    {track.duration_ms ? formatMs(track.duration_ms) : '—'}
                  </span>

                  <button
                    onClick={() => handlePlay(track)}
                    disabled={isPlaying}
                    className="shrink-0 px-4 py-1.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black text-sm font-bold transition-colors"
                  >
                    {isPlaying ? '…' : 'Play'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
