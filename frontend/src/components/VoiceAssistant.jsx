import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../api'

const HOTKEY = 'Alt + Q'
const POLL_INTERVAL_MS = 2500
const PULSE_DURATION_MS = 5000  // Glow/pulse after command is sent
const MIN_HOLD_MS = 200  // Ignore very short taps so mic doesn't stay open / no empty sends

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
  const startStopRef = useRef({ start: null, stop: null })
  const hotkeyDownAtRef = useRef(0)
  const stopRequestedRef = useRef(false)

  const handleMicClick = () => {
    const { start, stop } = startStopRef.current
    if (!start || !stop) return
    if (recognitionRef.current && startedByHoldRef.current) {
      stop()
    } else {
      // Started via click, not hotkey — avoid onend auto-restart
      hotkeyDownRef.current = false
      start()
    }
  }

  useEffect(() => {
    function startListening() {
      if (!SpeechRecognitionAPI || recognitionRef.current) return
      transcriptRef.current = ''
      hotkeyDownAtRef.current = Date.now()
      stopRequestedRef.current = false
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

        // If we didn't explicitly request a stop (via Alt+Q up or mic click),
        // treat this as an unexpected end and immediately restart listening.
        if (!stopRequestedRef.current) {
          recognitionRef.current = null
          startListening()
          return
        }

        recognitionRef.current = null
        const transcript = transcriptRef.current.trim()
        const holdDuration = Date.now() - hotkeyDownAtRef.current
        if (transcript) {
          sendToPlay(transcript)
        } else if (holdDuration < MIN_HOLD_MS) {
          // Very short tap: don't send empty command.
        }
      }
      recognition.onerror = (e) => {
        setBrowserListening(false)
        // Only surface hard errors; ignore transient ones while the hotkey/click is held.
        if (e.error === 'not-allowed') {
          setError('Microphone access denied.')
        } else if (e.error !== 'aborted' && stopRequestedRef.current) {
          setError('Speech recognition error.')
        }
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
      stopRequestedRef.current = true
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (_) {
          try {
            recognitionRef.current.abort()
          } catch (_) {}
        }
        recognitionRef.current = null
      }
      hotkeyDownRef.current = false
    }

    function onKeyDown(e) {
      const isAltQ =
        (e.key === 'q' || e.key === 'Q') && e.altKey
      if (isAltQ) {
        // Always prevent the browser's default Alt+Q behavior
        e.preventDefault()
        e.stopPropagation()

        // If we don't have Electron (pure web), fall back to in-window handling
        if (!window.electronAPI) {
          if (hotkeyDownRef.current) return // key repeat
          hotkeyDownRef.current = true
          startListening()
        }
      }
    }

    function onKeyUp(e) {
      const isQ = e.key === 'q' || e.key === 'Q'
      const isAlt = e.key === 'Alt'
      if (isQ || isAlt) {
        if (!window.electronAPI) {
          if (recognitionRef.current && startedByHoldRef.current) {
            stopListening()
          } else {
            hotkeyDownRef.current = false
          }
        }
      }
    }

    startStopRef.current = { start: startListening, stop: stopListening }

    // Global Electron hotkey (preferred)
    let offHotkeyDown
    let offHotkeyUp
    if (window.electronAPI?.onHotkeyDown) {
      offHotkeyDown = window.electronAPI.onHotkeyDown(() => {
        hotkeyDownRef.current = true
        const { start } = startStopRef.current
        if (start) start()
      })
    }
    if (window.electronAPI?.onHotkeyUp) {
      offHotkeyUp = window.electronAPI.onHotkeyUp(() => {
        hotkeyDownRef.current = false
        const { stop } = startStopRef.current
        if (stop) stop()
      })
    }

    // Browser key events as fallback (and to suppress Alt+Q default)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)

    // Pre-request mic permission on first interaction (helps Web Speech API work from global hotkey)
    const requestMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      } catch (_) {}
    }
    const onFirstInteraction = () => requestMic()
    document.addEventListener('click', onFirstInteraction, { once: true })
    document.addEventListener('keydown', onFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      if (offHotkeyDown) offHotkeyDown()
      if (offHotkeyUp) offHotkeyUp()
      document.removeEventListener('click', onFirstInteraction)
      document.removeEventListener('keydown', onFirstInteraction)
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch (_) {}
      }
      // Keep start/stop in ref so mic click still works if effect re-runs (e.g. Strict Mode)
    }
  }, [])

  useEffect(() => {
    let lastId = null

    async function poll() {
      try {
        const res = await fetch(apiUrl('mood-requests?limit=3'))
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
      const res = await fetch(apiUrl('play'), {
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
      if (window.electronAPI?.sendCommandProcessed) {
        const resolved =
          data.mode === 'track' && data.track
            ? `Playing: ${data.track}`
            : data.mode === 'artist' && data.artist
              ? `Artist mix: ${data.artist}`
              : data.mode === 'multi'
                ? 'Playing mix'
                : data.track || data.artist || data.mode || 'Done'
        window.electronAPI.sendCommandProcessed(resolved)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const showListening = processing || browserListening

  return (
    <section className="bg-[#181818] rounded-xl sm:rounded-2xl p-5 sm:p-8 mb-5 sm:mb-8 border border-[#282828]">
      {/* Prominent hotkey call-to-action */}
      <div className="flex flex-col items-center gap-4 sm:gap-6 text-center mb-5 sm:mb-8">
        <button
          type="button"
          onClick={handleMicClick}
          className={`relative w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:ring-offset-2 focus:ring-offset-[#181818] ${
            showListening
              ? 'bg-[#1DB954]/40 shadow-[0_0_30px_rgba(29,185,84,0.6)] animate-pulse'
              : 'bg-[#282828] hover:bg-[#333]'
          }`}
          aria-label={showListening ? 'Stop listening' : 'Start listening'}
        >
          <svg
            viewBox="0 0 24 24"
            className={`w-8 h-8 sm:w-12 sm:h-12 flex-shrink-0 ${
              showListening ? 'fill-[#1DB954] stroke-[#1DB954]' : 'fill-none stroke-[#b3b3b3] stroke-2'
            }`}
          >
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {showListening && (
            <span className="absolute inset-0 rounded-full border-2 border-[#1DB954] animate-ping opacity-30 pointer-events-none" aria-hidden />
          )}
        </button>

        <div>
          <p className="text-white text-lg sm:text-2xl font-bold mb-1">
            {browserListening ? 'Listening…' : sending ? 'Playing…' : `Hold ${HOTKEY} to speak`}
          </p>
          <p className="text-[#b3b3b3] text-sm">
            {browserListening
              ? 'Say your command, then release Alt+Q'
              : 'Hold Alt+Q while you speak, then release to send. Or click the mic.'}
          </p>
          {!SpeechRecognitionAPI && (
            <p className="text-amber-400 text-xs mt-2">Use Chrome or Edge for voice.</p>
          )}
        </div>
      </div>

      {/* Last 3 Voice Commands */}
      <div className="border-t border-[#282828] pt-4 sm:pt-6">
        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-widest text-[#b3b3b3]">
          Recent Commands
        </h3>

        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}

        {requests.length === 0 ? (
          <p className="text-[#535353] text-sm italic">
            Hold Alt+Q to speak, or click the mic.
          </p>
        ) : (
          <ul className="space-y-3 sm:space-y-4">
            {requests.slice(0, 3).map((cmd, i) => (
              <li key={cmd.id ?? i} className="border-b border-[#282828] pb-3 sm:pb-4 last:border-0 last:pb-0">
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
