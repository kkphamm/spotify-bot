import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  {
    label: 'Home',
    to: '/',
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill={active ? 'white' : 'none'} stroke={active ? 'none' : 'currentColor'} strokeWidth="2">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'Playlists',
    to: '/playlists',
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="2">
        <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="2">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-16 min-w-16 sm:w-52 min-h-screen bg-black shrink-0">
      {/* Logo */}
      <div className="px-3 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 fill-[#1DB954] shrink-0">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <span className="text-white font-bold text-sm sm:text-lg tracking-tight hidden sm:inline">Music AI</span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="px-2 sm:px-3 mb-4 sm:mb-6">
        {NAV_ITEMS.map(({ label, to, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center justify-center sm:justify-start gap-3 sm:gap-4 px-2 sm:px-3 py-2.5 sm:py-3 rounded-md text-sm font-semibold transition-colors duration-150 ${
                isActive
                  ? 'text-white bg-[#282828]'
                  : 'text-[#b3b3b3] hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-white' : 'text-[#b3b3b3]'}>
                  {icon(isActive)}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 sm:mx-6 border-t border-[#282828] mb-3 sm:mb-4" />

      {/* Library section - hidden on narrow */}
      <div className="px-3 sm:px-6 flex-1 hidden sm:block">
        <p className="text-[#b3b3b3] text-xs font-bold uppercase tracking-widest mb-3">Your Library</p>
        <p className="text-[#535353] text-sm">Nothing here yet.</p>
      </div>

      {/* Footer */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 mt-auto hidden sm:block">
        <p className="text-[#535353] text-xs">AI Music Assistant</p>
      </div>
    </aside>
  )
}
