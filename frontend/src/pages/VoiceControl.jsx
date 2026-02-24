import { useState } from 'react'
import Topbar from '../components/Topbar'

const HOTKEY = 'Ctrl + Shift + L'

export default function VoiceControl() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full">
      <div className="bg-gradient-to-b from-[#2a1a1a] to-[#121212] pb-8">
        <Topbar title="Voice Control" />
      </div>

      <div className="px-8 py-6 max-w-2xl">
        {/* Hotkey callout */}
        <div className="bg-[#181818] rounded-xl p-5 mb-8 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 flex items-center justify-center shrink-0 mt-0.5">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-[#1DB954] stroke-2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold mb-1">Voice Hotkey</p>
            <p className="text-[#b3b3b3] text-sm">
              Press <kbd className="bg-[#282828] text-white text-xs font-mono px-2 py-0.5 rounded border border-[#535353]">{HOTKEY}</kbd> in the voice client terminal to start listening. The script will record your voice, transcribe it, and send it to the assistant automatically.
            </p>
          </div>
        </div>

        {/* Manual text input */}
        <h2 className="text-white font-bold text-lg mb-3">Send a command manually</h2>
        <form onSubmit={handleSend} className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "Play something chill" or "Play Starboy by The Weeknd"'
            rows={3}
            className="w-full bg-[#181818] text-white placeholder-[#535353] rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1DB954] border border-[#282828]"
          />
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="self-start bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-40 text-black font-bold px-6 py-3 rounded-full text-sm transition-colors duration-150"
          >
            {loading ? 'Sending…' : 'Send to Assistant'}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 bg-[#181818] rounded-xl p-5 border border-[#282828]">
            <p className="text-[#1DB954] text-xs font-bold uppercase tracking-widest mb-2">Now Playing</p>
            {result.mode === 'track' && (
              <p className="text-white font-bold">{result.track} — {result.artists?.join(', ')}</p>
            )}
            {result.mode === 'artist' && (
              <p className="text-white font-bold">Artist mix · {result.artist}</p>
            )}
            {result.mode === 'multi' && (
              <p className="text-white font-bold">{result.track_count} tracks across {result.artists?.length} artists</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
