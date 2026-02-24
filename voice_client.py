import math
import struct
import sys
import threading
import wave
from collections import deque

import numpy as np
import pyaudio
import requests
from openai import OpenAI
from pynput import keyboard

try:
    from plyer import notification
except ImportError:
    notification = None

sys.stdout.reconfigure(encoding="utf-8")

from backend.config import OPENAI_API_KEY

SAMPLE_RATE      = 16000   # Hz — Whisper works best at 16 kHz
CHANNELS         = 1
CHUNK            = 512     # Smaller chunks = finer silence detection
OUTPUT_FILE      = "input.wav"
BACKEND_URL      = "http://localhost:8000/play"

SILENCE_DURATION = 1.5     # Seconds of silence before stopping
CALIBRATE_SECS   = 1.0     # Seconds to sample ambient noise on startup
SILENCE_MARGIN   = 1.8     # Multiplier over ambient RMS to count as speech
PREROLL_CHUNKS   = 8       # Chunks to keep before speech starts (avoids cutting off first word)
MAX_RECORD_SECS  = 30      # Hard cap — stops if you never go quiet


def _rms(chunk: bytes) -> float:
    """Root-mean-square amplitude of a raw PCM chunk."""
    count = len(chunk) // 2
    if count == 0:
        return 0.0
    shorts = struct.unpack(f"{count}h", chunk)
    return math.sqrt(sum(s * s for s in shorts) / count)


def _calibrate(stream: pyaudio.Stream) -> float:
    """Measure ambient noise level so the threshold adapts to the environment."""
    print("Calibrating ambient noise... (stay quiet)")
    chunks = int(SAMPLE_RATE / CHUNK * CALIBRATE_SECS)
    levels = [_rms(stream.read(CHUNK)) for _ in range(chunks)]
    ambient = sum(levels) / len(levels)
    threshold = max(ambient * SILENCE_MARGIN, 80)   # 80 = absolute floor
    print(f"Threshold set to {threshold:.0f} RMS  (ambient: {ambient:.0f})\n")
    return threshold


def record(output: str = OUTPUT_FILE) -> str:
    """
    Record from the microphone using silence detection.
    - Waits until speech is detected above the noise threshold.
    - Stops automatically after SILENCE_DURATION seconds of silence.
    """
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=pyaudio.paInt16,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK,
    )

    threshold = _calibrate(stream)

    print("Listening... (speak when ready)")
    preroll   = deque(maxlen=PREROLL_CHUNKS)   # circular buffer before speech
    frames    = []
    speaking  = False
    silent_chunks = 0
    silence_limit = int(SAMPLE_RATE / CHUNK * SILENCE_DURATION)
    max_chunks    = int(SAMPLE_RATE / CHUNK * MAX_RECORD_SECS)
    total_chunks  = 0

    while total_chunks < max_chunks:
        chunk = stream.read(CHUNK, exception_on_overflow=False)
        level = _rms(chunk)
        total_chunks += 1

        if not speaking:
            preroll.append(chunk)
            if level > threshold:
                speaking = True
                frames.extend(preroll)   # include the pre-roll so the word isn't clipped
                print("Recording...    ", end="\r")
        else:
            frames.append(chunk)
            if level <= threshold:
                silent_chunks += 1
                if silent_chunks >= silence_limit:
                    break
            else:
                silent_chunks = 0

    stream.stop_stream()
    stream.close()

    if not speaking:
        audio.terminate()
        return ""

    print("Done.           ")

    with wave.open(output, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(audio.get_sample_size(pyaudio.paInt16))
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))

    audio.terminate()
    return output


def record_until_silence(
    output: str = OUTPUT_FILE,
    threshold: float = 500.0,
    silence_duration: float = SILENCE_DURATION,
) -> str:
    """
    Record from the microphone using numpy-based RMS volume detection.

    - Waits until a chunk's RMS volume exceeds `threshold` (speech onset).
    - Stops and saves the file once volume stays below `threshold` for
      `silence_duration` continuous seconds.
    - Returns the path to the saved .wav file, or an empty string if no
      speech was detected before the hard cap (MAX_RECORD_SECS).
    """
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=pyaudio.paInt16,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK,
    )

    silence_limit  = int(SAMPLE_RATE / CHUNK * silence_duration)
    max_chunks     = int(SAMPLE_RATE / CHUNK * MAX_RECORD_SECS)
    preroll        = deque(maxlen=PREROLL_CHUNKS)
    frames         = []
    speaking       = False
    silent_chunks  = 0
    total_chunks   = 0

    print("Listening... (speak when ready)")

    while total_chunks < max_chunks:
        raw   = stream.read(CHUNK, exception_on_overflow=False)
        total_chunks += 1

        # numpy RMS: interpret raw bytes as signed 16-bit PCM samples
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
        rms     = float(np.sqrt(np.mean(samples ** 2))) if samples.size else 0.0

        if not speaking:
            preroll.append(raw)
            if rms > threshold:
                speaking = True
                frames.extend(preroll)
                print("Recording...    ", end="\r")
        else:
            frames.append(raw)
            if rms <= threshold:
                silent_chunks += 1
                if silent_chunks >= silence_limit:
                    break
            else:
                silent_chunks = 0

    stream.stop_stream()
    stream.close()

    if not speaking:
        audio.terminate()
        return ""

    print("Done.           ")

    with wave.open(output, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(audio.get_sample_size(pyaudio.paInt16))
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))

    audio.terminate()
    return output


def transcribe_audio(file_path: str) -> str:
    """Transcribe a WAV file to text using OpenAI's whisper-1 model."""
    client = OpenAI(api_key=OPENAI_API_KEY)
    with open(file_path, "rb") as f:
        result = client.audio.transcriptions.create(model="whisper-1", file=f)
    return result.text


def send_to_assistant(text: str) -> dict:
    """POST the transcribed text to the FastAPI /play endpoint."""
    response = requests.post(BACKEND_URL, json={"message": text}, timeout=30)
    response.raise_for_status()
    return response.json()


def _notify_success(title: str, message: str) -> None:
    """Show a desktop notification or play a success sound."""
    if notification:
        try:
            notification.notify(
                title=title,
                message=message,
                app_name="AI Music Assistant",
                timeout=3,
            )
        except Exception:
            pass
    try:
        import winsound
        winsound.MessageBeep(winsound.MB_OK)
    except Exception:
        pass


def _print_result(result: dict) -> None:
    mode = result.get("mode", "?")
    if mode == "track":
        print(f"  Playing: {result['track']} — {', '.join(result['artists'])}")
    elif mode == "artist":
        print(f"  Playing artist: {result['artist']}")
    elif mode == "multi":
        print(f"  Playing mix: {result['track_count']} tracks across {len(result['artists'])} artists")
    else:
        print(f"  Response: {result}")


_trigger_record = threading.Event()


def _on_hotkey():
    _trigger_record.set()


_hotkey_listener = keyboard.GlobalHotKeys({"<ctrl>+<shift>+l": _on_hotkey})
_hotkey_listener.start()


def _wait_for_trigger():
    """Block until user presses Enter or Ctrl+Shift+L."""
    _trigger_record.clear()

    def wait_enter():
        try:
            input()
        except EOFError:
            pass
        _trigger_record.set()

    t = threading.Thread(target=wait_enter, daemon=True)
    t.start()
    _trigger_record.wait()
    if t.is_alive():
        t.join(timeout=0.1)


if __name__ == "__main__":
    print("=== AI Music Assistant — Voice Mode ===")
    print("Press Enter or Ctrl+Shift+L when ready to speak. Ctrl+C to quit.\n")
    session = 1

    while True:
        try:
            _wait_for_trigger()
            wav = record()

            if not wav:
                print("No speech detected — try again.\n")
                continue

            print("Transcribing...")
            text = transcribe_audio(wav)
            print(f'  You said: "{text}"')
            if text and text.strip():
                _notify_success("Transcription", text.strip())

            print("Sending to assistant...")
            result = send_to_assistant(text)
            _print_result(result)
            mode = result.get("mode", "")
            if mode == "track":
                summary = f"{result.get('track', '')} — {', '.join(result.get('artists', []))}"
            elif mode == "artist":
                summary = f"Artist mix: {result.get('artist', '')}"
            elif mode == "multi":
                summary = f"{result.get('track_count', 0)} tracks playing"
            else:
                summary = "Playing"
            _notify_success("Playing", summary)

            session += 1
            print()

        except requests.HTTPError as e:
            print(f"  Backend error: {e.response.text}\n")
        except KeyboardInterrupt:
            print("\nGoodbye.")
            break
