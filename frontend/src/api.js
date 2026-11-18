// The desktop app calls the local backend directly.
const API_BASE = window.electronAPI ? 'http://127.0.0.1:8000' : '/api'

export function apiUrl(path) {
  const clean = path.startsWith('/') ? path.slice(1) : path
  return `${API_BASE}/${clean}`
}

export function signInToSpotify() {
  if (window.electronAPI) {
    window.electronAPI.openSpotifyLogin()
  } else {
    window.location.href = apiUrl('auth')
  }
}
