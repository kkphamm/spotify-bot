# AI Music Assistant

Control Spotify with natural language. Use voice or text — the app parses your intent and plays the right music. Connect playlists by name for instant voice control (e.g. *"Play My Chill Mix"*).

![Demo](docs/demo.gif)

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Add your keys to .env (see Setup below)

# 3. From project root: start backend + desktop app in one command
npm run dev

# Or run separately:
# Terminal 1: uvicorn backend.main:app --reload
# Terminal 2: cd frontend && npm install && npm run electron:dev
```

First time, run `npm ci` in `frontend` and connect your Spotify account in the app.

### macOS Desktop

With the project's backend installed in `.venv`, run `npm run electron:build:mac` from `frontend`.
Open `Spotify Bot.app` in `frontend/release/mac-arm64` on Apple Silicon or `frontend/release/mac` on Intel. The app starts the backend from this checkout and uses its `.env`.

Enable **Spotify Bot** in **System Settings → Privacy & Security → Accessibility** for the global hotkey. Allow microphone access when prompted.

---

## How It Works

1. **You** speak or type a command (e.g. *"Play lo-fi beats"*, *"Play My Chill Mix"*).
2. **Intent Engine** (GPT-6 Luna) extracts the action and search query.
3. **Playback mode** is chosen:
   - **Connected Playlist** — query matches a playlist you connected → play that playlist
   - **Track** — you named a song → play that track (with autoplay recommendations)
   - **Artist** — you named an artist → play their top tracks
   - **Multi** — genre/mood → search tracks, extend with recommendations, shuffle
4. **Spotify** starts playback on your active device.

---

## Voice Input

| Method | How |
|--------|-----|
| **Desktop app** | Hold **⌘⇧Space** on macOS or **Ctrl+Shift+Space** on Windows. Release to send. The pill overlay appears while you speak, including when the app is in the background. |
| **Terminal** | Run `python -X utf8 voice_client.py`, then press Enter or **Ctrl+Shift+L** to record. |

The desktop app records with MediaRecorder and sends audio to the backend. Both the desktop app and terminal client use OpenAI GPT-Transcribe.

---

## Setup

### Environment Variables (`.env`)

| Key | Where |
|-----|-------|
| `SPOTIFY_CLIENT_ID` | [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | Same app → Settings |
| `SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:8000/callback` |
| `SPOTIFY_CACHE_PATH` | `.cache-spotify-bot` keeps OAuth tokens in an ignored file |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

Add `http://127.0.0.1:8000/callback` as a Redirect URI in your Spotify app settings.

### Auth Flow

1. Launch the app and choose **Sign in to Spotify** if prompted.
2. Sign in with Spotify and approve, then return to the app.
3. The OAuth token is saved to `SPOTIFY_CACHE_PATH` for future requests.
4. Use **Settings → Reauthorize Spotify** to re-link, or **Log out** to clear the token and re-auth on next launch.

---

## Project Structure

```
ai_music_assistant/
├── backend/
│   ├── main.py           # FastAPI routes
│   ├── spotify_client.py # Spotify API (search, play, recommendations)
│   ├── intent_engine.py  # OpenAI intent parser
│   ├── database.py       # SQLAlchemy session
│   ├── models.py         # MoodRequest, ConnectedPlaylist
│   └── config.py        # Env / API keys
├── frontend/             # React + Vite + Tailwind + Electron
│   ├── electron/        # Main process, preload, global hotkey, pill overlay
│   ├── src/
│   │   ├── components/  # VoiceAssistant, FeatureGrid, Sidebar, Topbar
│   │   ├── contexts/    # UserContext, PlaylistsContext
│   │   └── pages/       # Home, TopTracks, ConnectedPlaylists, Settings, PillOverlay
│   └── ...
├── voice_client.py       # Terminal voice input
├── package.json          # Root scripts (e.g. npm run dev)
└── .env                  # API keys
```

---

## API Overview

| Endpoint | Description |
|----------|-------------|
| `GET /auth` | Start Spotify OAuth |
| `GET /callback` | OAuth callback (redirects to frontend) |
| `POST /logout` | Clear Spotify token |
| `GET /me` | Current user profile |
| `GET /devices` | List playback devices |
| `GET /top-tracks?limit=10` | Your top tracks |
| `GET /my-spotify-playlists` | Your Spotify playlists |
| `GET /connected-playlists` | Playlists connected for voice control |
| `POST /connect-playlist` | Connect a playlist by name |
| `DELETE /disconnect-playlist/{spotify_id}` | Disconnect a playlist |
| `POST /play` | Natural language → play music |
| `POST /play-track` | Play by Spotify URI |
| `POST /transcribe` | Upload audio for GPT-Transcribe and receive `{ "text": "..." }` |
| `GET /latest-command` | Last voice/text command |
| `GET /mood-requests` | History of commands and intent |

---

## Tech Stack

- **Backend:** FastAPI, Spotipy, OpenAI, SQLAlchemy
- **Frontend:** React, Vite, Tailwind, Electron (macOS and Windows desktop)
- **Voice:** MediaRecorder (desktop), PyAudio (terminal), OpenAI GPT-Transcribe
