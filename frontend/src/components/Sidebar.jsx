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
    label: 'Top Tracks',
    to: '/top-tracks',
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={active ? 3 : 2}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    label: 'Voice Control',
    to: '/voice',
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={active ? 3 : 2}>
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-60 min-h-screen bg-black shrink-0">
      {/* Logo */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#1DB954]">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <span className="text-white font-bold text-lg tracking-tight">Music AI</span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="px-3 mb-6">
        {NAV_ITEMS.map(({ label, to, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-4 px-3 py-3 rounded-md text-sm font-semibold transition-colors duration-150 ${
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
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-6 border-t border-[#282828] mb-4" />

      {/* Library section */}
      <div className="px-6 flex-1">
        <p className="text-[#b3b3b3] text-xs font-bold uppercase tracking-widest mb-3">
          Your Library
        </p>
        <p className="text-[#535353] text-sm">Nothing here yet.</p>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 mt-auto">
        <p className="text-[#535353] text-xs">AI Music Assistant</p>
      </div>
    </aside>
  )
}
