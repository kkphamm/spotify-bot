export default function Topbar({ title }) {
  return (
    <header className="flex items-center justify-between px-8 py-5 bg-gradient-to-b from-black/40 to-transparent sticky top-0 z-10 backdrop-blur-sm">
      <h1 className="text-white text-2xl font-bold">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#282828] flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#b3b3b3]">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
      </div>
    </header>
  )
}
