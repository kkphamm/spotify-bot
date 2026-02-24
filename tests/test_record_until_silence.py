"""
Unit tests for record_until_silence() using synthetic PCM data.
No real microphone or audio hardware is required.
"""

import os
import sys
import tempfile
import types
import wave

import numpy as np

# ── Stubs so voice_client imports cleanly without real hardware ───────────────

# pyaudio stub
pa_mod = types.ModuleType("pyaudio")
pa_mod.paInt16 = 8


class _FakeStream:
    def __init__(self, chunks):
        self._chunks = iter(chunks)

    def read(self, n, exception_on_overflow=False):
        return next(self._chunks)

    def stop_stream(self):
        pass

    def close(self):
        pass


class _FakePyAudio:
    _stream = None

    def open(self, **kw):
        return _FakePyAudio._stream

    def get_sample_size(self, fmt):
        return 2  # 16-bit → 2 bytes

    def terminate(self):
        pass


pa_mod.PyAudio = _FakePyAudio
pa_mod.Stream  = _FakeStream   # satisfies type annotations in voice_client
sys.modules["pyaudio"] = pa_mod

# openai stub
oa_mod = types.ModuleType("openai")


class _FakeOpenAI:
    def __init__(self, **kw):
        pass


oa_mod.OpenAI = _FakeOpenAI
sys.modules["openai"] = oa_mod

# pynput stub
pynput_mod = types.ModuleType("pynput")
kb_mod = types.ModuleType("pynput.keyboard")


class _FakeHotkeys:
    def __init__(self, mapping):
        pass

    def start(self):
        pass


kb_mod.GlobalHotKeys = _FakeHotkeys
pynput_mod.keyboard = kb_mod
sys.modules["pynput"] = pynput_mod
sys.modules["pynput.keyboard"] = kb_mod

# requests stub
sys.modules["requests"] = types.ModuleType("requests")

# backend.config stub
cfg_pkg = types.ModuleType("backend")
cfg_mod = types.ModuleType("backend.config")
cfg_mod.OPENAI_API_KEY = "test"
sys.modules["backend"] = cfg_pkg
sys.modules["backend.config"] = cfg_mod

# ── Now import the module under test ─────────────────────────────────────────
from voice_client import CHUNK, SAMPLE_RATE, record_until_silence  # noqa: E402

THRESHOLD = 500.0


def _make_chunk(amplitude: int) -> bytes:
    """512 samples of a 440 Hz sine at the given amplitude (int16 PCM)."""
    t = np.linspace(0, 1, CHUNK, endpoint=False)
    samples = (amplitude * np.sin(2 * np.pi * 440 * t)).astype(np.int16)
    return samples.tobytes()


SILENCE_CHUNK = _make_chunk(100)   # RMS ≈ 71  — below threshold
SPEECH_CHUNK  = _make_chunk(1000)  # RMS ≈ 707 — above threshold


# ── Test 1: normal speech-then-silence flow ───────────────────────────────────
def test_speech_detected_and_file_written():
    # silence_limit = int(16000/512 * 1.5) = 46 chunks → feed 60 to be safe
    chunks = [SILENCE_CHUNK] * 5 + [SPEECH_CHUNK] * 10 + [SILENCE_CHUNK] * 60

    _FakePyAudio._stream = _FakeStream(chunks)

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    try:
        result = record_until_silence(
            output=tmp.name, threshold=THRESHOLD, silence_duration=1.5
        )

        assert result == tmp.name, f"Expected file path, got: {repr(result)}"
        assert os.path.exists(result), "Output .wav file was not created"

        with wave.open(result, "rb") as wf:
            assert wf.getnchannels() == 1,     "Wrong channel count"
            assert wf.getsampwidth() == 2,     "Wrong sample width"
            assert wf.getframerate() == 16000, "Wrong frame rate"
            assert wf.getnframes()   >  0,     "No audio frames written"

        print("PASS  test_speech_detected_and_file_written")
    finally:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)


# ── Test 2: all silence → returns empty string ────────────────────────────────
def test_all_silence_returns_empty_string():
    import voice_client
    original_max = voice_client.MAX_RECORD_SECS
    voice_client.MAX_RECORD_SECS = 0.1  # very short cap so the loop exits fast

    _FakePyAudio._stream = _FakeStream([SILENCE_CHUNK] * 10_000)

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    try:
        result = record_until_silence(
            output=tmp.name, threshold=THRESHOLD, silence_duration=1.5
        )
        assert result == "", f"Expected empty string, got: {repr(result)}"
        assert not os.path.exists(tmp.name) or os.path.getsize(tmp.name) == 0, \
            "File should not have been written for all-silence input"
        print("PASS  test_all_silence_returns_empty_string")
    finally:
        voice_client.MAX_RECORD_SECS = original_max
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)


# ── Test 3: preroll chunks are included in the recording ─────────────────────
def test_preroll_included():
    """
    The PREROLL_CHUNKS (8) silence chunks before speech onset should be
    prepended to the recording so the first word isn't clipped.
    We count the frames written and confirm preroll + speech are all present.
    """
    import voice_client
    preroll_count = voice_client.PREROLL_CHUNKS  # 8
    speech_count  = 10
    post_silence  = 60  # enough to trigger silence-stop

    chunks = (
        [SILENCE_CHUNK] * preroll_count
        + [SPEECH_CHUNK] * speech_count
        + [SILENCE_CHUNK] * post_silence
    )
    _FakePyAudio._stream = _FakeStream(chunks)

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    try:
        result = record_until_silence(
            output=tmp.name, threshold=THRESHOLD, silence_duration=1.5
        )
        assert result, "Expected a file path"

        with wave.open(result, "rb") as wf:
            # Each chunk is CHUNK samples; preroll + speech frames should all be there
            expected_min_frames = (preroll_count + speech_count) * CHUNK
            assert wf.getnframes() >= expected_min_frames, (
                f"Expected >= {expected_min_frames} frames, got {wf.getnframes()}"
            )
        print("PASS  test_preroll_included")
    finally:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)


# ── Run all tests ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    test_speech_detected_and_file_written()
    test_all_silence_returns_empty_string()
    test_preroll_included()
    print("\nAll tests passed.")
