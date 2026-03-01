import { createContext, useContext, useState, useCallback } from 'react'
import { apiUrl } from '../api'

const PlaylistsContext = createContext(null)

export function PlaylistsProvider({ children }) {
  const [spotifyPlaylists, setSpotifyPlaylists] = useState(null)
  const [connectedPlaylists, setConnectedPlaylists] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPlaylists = useCallback(() => {
    if (spotifyPlaylists !== null) return
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
  }, [spotifyPlaylists])

  const value = {
    spotifyPlaylists,
    setSpotifyPlaylists,
    connectedPlaylists,
    setConnectedPlaylists,
    loading,
    error,
    setError,
    fetchPlaylists,
    hasFetched: spotifyPlaylists !== null,
  }

  return (
    <PlaylistsContext.Provider value={value}>
      {children}
    </PlaylistsContext.Provider>
  )
}

export function usePlaylists() {
  const ctx = useContext(PlaylistsContext)
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistsProvider')
  return ctx
}
