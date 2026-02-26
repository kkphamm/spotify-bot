// In Electron (file:// or localhost), API calls go to backend directly
const API_BASE = typeof window !== 'undefined' && window.electronAPI
  ? 'http://localhost:8000'
  : '/api'

export function apiUrl(path) {
  const clean = path.startsWith('/') ? path.slice(1) : path
  return API_BASE.startsWith('http') ? `${API_BASE}/${clean}` : `${API_BASE}/${clean}`
}
