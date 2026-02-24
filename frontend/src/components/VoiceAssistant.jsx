import { useEffect, useRef, useState } from 'react'

const HOTKEY = 'Ctrl + Shift + L'
const POLL_INTERVAL_MS = 2500
const PULSE_DURATION_MS = 5000  // Glow/pulse after command is sent

const SpeechRecognitionAPI =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function VoiceAssistant() {
  const [requests, setRequests] = useState([])
  const [processing, setProcessing] = useState(false)
  const [browserListening, setBrowserListening] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const startedByHoldRef = useRef(false)
  const hotkeyDownRef = useRef(false)
  const transcriptRef = useRef('')

  useEffect(() => {
    function startListening() {
      if (!SpeechRecognitionAPI || recognitionRef.current) return
      transcriptRef.current = ''
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new Recognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        startedByHoldRef.current = true
        setBrowserListening(true)
      }
      recognition.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal && r[0]?.transcript) {
            transcriptRef.current += (transcriptRef.current ? ' ' : '') + r[0].transcript
          }
        }
      }
      recognition.onend = () => {
        setBrowserListening(false)
        if (!startedByHoldRef.current) return
        startedByHoldRef.current = false
        recognitionRef.current = null
        const transcript = transcriptRef.current.trim()
        if (transcript) sendToPlay(transcript)
      }
      recognition.onerror = (e) => {
        setBrowserListening(false)
        startedByHoldRef.current = false
        if (e.error === 'not-allowed') setError('Microphone access denied.')
        else if (e.error !== 'aborted') setError('Speech recognition error.')
      }

      recognitionRef.current = recognition
      setError(null)
      try {
        recognition.start()
      } catch (_) {
        setError('Could not start microphone.')
      }
    }

    function stopListening() {
      if (recognitionRef.current && startedByHoldRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (_) {}
      }
      hotkeyDownRef.current = false
    }

    function onKeyDown(e) {
      if (e.key === 'L' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        if (hotkeyDownRef.current) return // key repeat
        hotkeyDownRef.current = true
        startListening()
      }
    }

    function onKeyUp(e) {
      if (e.key === 'L' || e.key === 'Control' || e.key === 'Shift') {
        if (recognitionRef.current && startedByHoldRef.current) {
          stopListening()
        } else {
          hotkeyDownRef.current = false
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true)  // capture phase to run before browser shortcuts
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch (_) {}
      }
    }
  }, [])

  useEffect(() => {
    let lastId = null

    async function poll() {
      try {
        const res = await fetch('/api/mood-requests?limit=3')
        if (!res.ok) return
        const data = await res.json()
        const items = data.requests ?? []

        if (items.length > 0) {
          const newest = items[0]
          if (lastId !== null && newest.id !== lastId) {
            setProcessing(true)
            setTimeout(() => setProcessing(false), PULSE_DURATION_MS)
          }
          lastId = newest.id ?? newest.message
        }
        setRequests(items)
      } catch (_) {
        // Backend may be offline - don't show error to user
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  async function sendToPlay(text) {
    if (!text || !text.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.detail?.[0] ?? res.statusText)
      setProcessing(true)
      setTimeout(() => setProcessing(false), PULSE_DURATION_MS)
      const newReq = { message: text.trim(), resolved_action: data.mode, resolved_query: data.track || data.artist, created_at: new Date().toISOString() }
      setRequests((prev) => [newReq, ...prev.slice(0, 2)])
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const showListening = processing || browserListening

  return (
    <section className="bg-[#181818] rounded-2xl p-8 mb-8 border border-[#282828]">
      {/* Prominent hotkey call-to-action */}
      <div className="flex flex-col items-center gap-6 text-center mb-8">
        <div
          className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
            showListening
              ? 'bg-[#1DB954]/40 shadow-[0_0_30px_rgba(29,185,84,0.6)] animate-pulse'
              : 'bg-[#282828]'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`w-12 h-12 flex-shrink-0 ${
              showListening ? 'fill-[#1DB954] stroke-[#1DB954]' : 'fill-none stroke-[#b3b3b3] stroke-2'
            }`}
          >
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {showListening && (
            <span className="absolute inset-0 rounded-full border-2 border-[#1DB954] animate-ping opacity-30" aria-hidden />
          )}
        </div>

        <div>
          <p className="text-white text-2xl font-bold mb-1">
            {browserListening ? 'Listening…' : sending ? 'Playing…' : `Hold ${HOTKEY} to speak`}
          </p>
          <p className="text-[#b3b3b3] text-sm">
            {browserListening
              ? 'Say your command, then release the keys'
              : 'Hold the keys while you speak, then release to send'}
          </p>
          {!SpeechRecognitionAPI && (
            <p className="text-amber-400 text-xs mt-2">Use Chrome or Edge for voice.</p>
          )}
        </div>
      </div>

      {/* Last 3 Voice Commands */}
      <div className="border-t border-[#282828] pt-6">
        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-widest text-[#b3b3b3]">
          Recent Commands
        </h3>

        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}

        {requests.length === 0 ? (
          <p className="text-[#535353] text-sm italic">Hold Ctrl+Shift+L to speak a command.</p>
        ) : (
          <ul className="space-y-4">
            {requests.slice(0, 3).map((cmd, i) => (
              <li key={cmd.id ?? i} className="border-b border-[#282828] pb-4 last:border-0 last:pb-0">
                <p className="text-white font-medium">{cmd.message}</p>
                <p className="text-[#1DB954] text-sm mt-0.5">
                  {cmd.resolved_action ?? '—'}
                  {cmd.resolved_query ? (
                    <span className="text-white font-normal ml-1">→ {cmd.resolved_query}</span>
                  ) : null}
                </p>
                {cmd.created_at && (
                  <p className="text-[#535353] text-xs mt-1">
                    {new Date(cmd.created_at).toLocaleTimeString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
