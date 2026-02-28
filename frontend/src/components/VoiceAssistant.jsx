import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../api'

const HOTKEY = 'Ctrl + Shift + Space'
const POLL_INTERVAL_MS = 2500
const PULSE_DURATION_MS = 5000  // Glow/pulse after command is sent

export default function VoiceAssistant() {
  const [requests, setRequests] = useState([])
  const [processing, setProcessing] = useState(false)
  const [browserListening, setBrowserListening] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const startedByHoldRef = useRef(false)
  const hotkeyDownRef = useRef(false)
  const startStopRef = useRef({ start: null, stop: null })
  const canvasRef = useRef(null)
  const requestRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const bufferRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const handleMicClick = () => {
    const { start, stop } = startStopRef.current
    if (!start || !stop) return
    if (mediaRecorderRef.current?.state === 'recording' && startedByHoldRef.current) {
      stop()
    } else {
      hotkeyDownRef.current = false
      start()
    }
  }

  useEffect(() => {
    async function sendAudioToWhisper(blob) {
      setSending(true)
      try {
        const formData = new FormData()
        formData.append('file', blob, 'voice.webm')
        const res = await fetch(apiUrl('transcribe'), {
          method: 'POST',
          body: formData,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.detail ?? data.message ?? 'Transcription failed')
        const text = (data.text ?? '').trim()
        if (text) sendToPlay(text)
      } catch (err) {
        setError(err.message ?? 'Could not transcribe audio.')
        setSending(false)
      }
    }

    async function startListening() {
      if (mediaRecorderRef.current?.state === 'recording') return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        const audioContext = new AudioContextClass()
        audioContextRef.current = audioContext
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.85
        analyserRef.current = analyser
        bufferRef.current = new Uint8Array(analyser.frequencyBinCount)
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        function drawVisualizer() {
          const canvas = canvasRef.current
          const anal = analyserRef.current
          const buffer = bufferRef.current
          if (!canvas || !anal || !buffer) return
          anal.getByteFrequencyData(buffer)
          if (window.electronAPI?.sendAudioData) {
            const compressedData = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
              .map((i) => buffer[i] ?? 0)
              .map((v) => Math.max(4, (v / 255) * 24))
            window.electronAPI.sendAudioData(compressedData)
          }
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const { width, height } = canvas
          ctx.clearRect(0, 0, width, height)
          const barCount = 16
          const barWidth = width / barCount
          const gap = 2
          const slotWidth = barWidth - gap
          const actualBarWidth = slotWidth * 0.4
          const minBarHeight = actualBarWidth * 1.8
          const centerY = height / 2
          ctx.fillStyle = '#1DB954'
          for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * buffer.length)
            const value = buffer[dataIndex] ?? 0
            const amplitude = Math.max(0, (value - 20) / 235)
            const barHeight = Math.max(minBarHeight, amplitude * height * 0.52)
            const x = i * barWidth + gap / 2 + (slotWidth - actualBarWidth) / 2
            const y = centerY - barHeight / 2
            ctx.beginPath()
            ctx.roundRect(x, y, actualBarWidth, barHeight, actualBarWidth / 2)
            ctx.fill()
          }
          requestRef.current = requestAnimationFrame(drawVisualizer)
        }
        drawVisualizer()

        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        recorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          sendAudioToWhisper(audioBlob)
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop())
          }
          if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {})
          }
          mediaStreamRef.current = null
          audioContextRef.current = null
          analyserRef.current = null
          mediaRecorderRef.current = null
          setBrowserListening(false)
        }
        audioChunksRef.current = []
        recorder.start()
        startedByHoldRef.current = true
        setBrowserListening(true)
        setError(null)
      } catch (err) {
        setError('Could not access microphone.')
      }
    }

    function stopListening() {
      if (requestRef.current != null) {
        cancelAnimationFrame(requestRef.current)
        requestRef.current = null
      }
      if (window.electronAPI?.sendAudioData) {
        window.electronAPI.sendAudioData(Array(10).fill(4))
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      hotkeyDownRef.current = false
    }

    function onKeyDown(e) {
      const isHotkey = e.code === 'Space' && e.ctrlKey && e.shiftKey
      if (isHotkey) {
        // Prevent browser default (scroll, etc.)
        e.preventDefault()
        e.stopPropagation()

        // Fallback: handle in-window when Electron is not present
        if (!window.electronAPI) {
          if (hotkeyDownRef.current) return // key repeat
          hotkeyDownRef.current = true
          startListening()
        }
      }
    }

    function onKeyUp(e) {
      const isSpace = e.code === 'Space'
      const isCtrl = e.key === 'Control'
      const isShift = e.key === 'Shift'
      if (isSpace || isCtrl || isShift) {
        if (mediaRecorderRef.current?.state === 'recording' && startedByHoldRef.current) {
          stopListening()
        }
        hotkeyDownRef.current = false
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

    // Browser key events as fallback (and to suppress Ctrl+Shift+Space default)
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
      if (mediaRecorderRef.current?.state === 'recording') {
        try { mediaRecorderRef.current.stop() } catch (_) {}
      }
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
    if (window.electronAPI?.logToTerminal) {
      window.electronAPI.logToTerminal('\n🎙️ User said: "' + text.trim() + '"')
    }
    if (!text || !text.trim()) return
    setSending(true)
    setError(null)
    try {
      console.log('🚀 Sending to backend: /play ->', text)
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

        <canvas ref={canvasRef} width="200" height="60" className="mx-auto mt-4" />

        <div>
          <p className="text-white text-lg sm:text-2xl font-bold mb-1">
            {browserListening ? 'Listening…' : sending ? 'Playing…' : `Hold ${HOTKEY} to speak`}
          </p>
          <p className="text-[#b3b3b3] text-sm">
            {browserListening
              ? 'Say your command, then release Ctrl+Shift+Space'
              : 'Hold Ctrl+Shift+Space while you speak, then release to send. Or click the mic.'}
          </p>
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
            Hold Ctrl+Shift+Space to speak, or click the mic.
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
