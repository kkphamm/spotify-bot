import { useEffect, useState, useMemo } from 'react'
import Topbar from '../components/Topbar'
import { apiUrl } from '../api'

export default function ConnectedPlaylists() {
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([])
  const [connectedPlaylists, setConnectedPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const connectedIds = useMemo(
    () => new Set(connectedPlaylists.map((cp) => cp.spotify_id)),
    [connectedPlaylists]
  )

  function isConnected(spotifyId) {
    return connectedIds.has(spotifyId)
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(apiUrl('my-spotify-playlists')).then((r) => {
        if (!r.ok) throw new Error('Failed to load Spotify playlists')
        return r.json()
      }),
      fetch(apiUrl('connected-playlists')).then((r) => {
        if (!r.ok) throw new Error('Failed to load connected playlists')
        return r.json()
      }),
    ])
      .then(([spotifyData, connectedData]) => {
        setSpotifyPlaylists(spotifyData.playlists ?? [])
        setConnectedPlaylists(Array.isArray(connectedData) ? connectedData : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(playlist) {
    const id = playlist.id
    if (!id) return
    setTogglingId(id)
    try {
      if (isConnected(id)) {
        const res = await fetch(apiUrl(`disconnect-playlist/${encodeURIComponent(id)}`), {
          method: 'DELETE',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail ?? 'Failed to disconnect')
        }
        setConnectedPlaylists((prev) => prev.filter((cp) => cp.spotify_id !== id))
      } else {
        const res = await fetch(apiUrl('connect-playlist'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spotify_id: id,
            name: playlist.name,
            uri: playlist.uri,
            image_url: playlist.image_url ?? null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.detail ?? 'Failed to connect')
        setConnectedPlaylists((prev) => [
          ...prev,
          {
            spotify_id: id,
            name: playlist.name,
            uri: playlist.uri,
            image_url: playlist.image_url,
            created_at: new Date().toISOString(),
          },
        ])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="min-h-full">
      <div className="bg-gradient-to-b from-[#1a3a2a] to-[#121212] pb-6">
        <Topbar title="Connected Playlists" />
      </div>

      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <p className="text-[#b3b3b3] text-sm mb-8 max-w-xl">
          Connect playlists so you can start them by name with voice (e.g. “Play My Chill Mix”).
        </p>

        {loading && (
          <div className="flex items-center gap-3 text-[#b3b3b3]">
            <div className="w-5 h-5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
            Loading playlists…
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {!loading && !error && spotifyPlaylists.length === 0 && (
          <p className="text-[#b3b3b3]">No Spotify playlists found. Create some in Spotify first.</p>
        )}

        {!loading && spotifyPlaylists.length > 0 && (
          <div className="grid grid-cols-2 gap-5 sm:gap-8 max-w-4xl">
            {spotifyPlaylists.map((playlist) => {
              const connected = isConnected(playlist.id)
              const busy = togglingId === playlist.id
              return (
                <div
                  key={playlist.id}
                  className="group rounded-xl bg-[#181818] hover:bg-[#282828] p-4 sm:p-5 transition-all duration-200 border border-[#282828] hover:border-[#333]"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-[#282828] mb-4 shadow-lg">
                    {playlist.image_url ? (
                      <img
                        src={playlist.image_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          className="w-16 h-16 fill-[#535353]"
                          aria-hidden
                        >
                          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="text-white font-semibold truncate mb-4 text-sm sm:text-base" title={playlist.name}>
                    {playlist.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleToggle(playlist)}
                    disabled={busy}
                    className={`
                      w-full py-2.5 rounded-full text-sm font-semibold transition-all duration-150
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${connected
                        ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
                        : 'border-2 border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10'
                      }
                    `}
                  >
                    {busy ? '…' : connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
