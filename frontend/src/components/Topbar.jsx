import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../api'

export default function Topbar({ title }) {
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    fetch(apiUrl('me'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setUser(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpen])

  async function handleLogout() {
    try {
      await fetch(apiUrl('logout'), { method: 'POST' })
    } catch (_) {}
    setMenuOpen(false)
    window.location.href = apiUrl('auth')
  }

  const imageUrl = user?.images?.[0]

  return (
    <header className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-5 bg-gradient-to-b from-black/40 to-transparent sticky top-0 z-10 backdrop-blur-sm">
      <h1 className="text-white text-lg sm:text-2xl font-bold truncate">{title}</h1>
      <div className="relative flex items-center gap-3" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-full focus:outline-none shrink-0"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label="Account menu"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-[#282828]"
            />
          ) : (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#282828] flex items-center justify-center border border-[#333]">
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-[#b3b3b3]">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 py-1 w-44 rounded-lg bg-[#282828] border border-[#333] shadow-xl z-20">
            {user?.display_name && (
              <p className="px-4 py-2 text-white text-sm font-medium truncate border-b border-[#333]">
                {user.display_name}
              </p>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-2.5 text-left text-[#b3b3b3] hover:text-white hover:bg-[#333] text-sm transition-colors flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
