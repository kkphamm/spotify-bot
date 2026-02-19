# AI Music Assistant

A FastAPI backend that combines Spotify and OpenAI to let you control music with natural language.

---

## What it does

You send a message like `"Play hurt by NewJeans"` and the app:
1. Parses your intent using OpenAI (falls back to keyword matching if unavailable)
2. Detects whether you named a specific song, an artist, or a genre/mood
3. Starts the right kind of playback on your active Spotify device — shuffle always on

---

## Project structure

```
ai_music_assistant/
  backend/
    main.py            # FastAPI app, all routes
    config.py          # Loads .env variables
    spotify_client.py  # Spotify API wrapper (spotipy)
    intent_engine.py   # OpenAI function-calling intent parser
    recommender.py     # Cosine similarity recommender (scikit-learn)
    database.py        # SQLAlchemy engine + session
    models.py          # User, TrackHistory, MoodRequest tables
    requirements.txt   # Python dependencies
  tests/
    test_play.py       # Tests all three play modes
    test_top_tracks.py # Tests /top-tracks
    test_recommend.py  # Tests /recommend
    test_db.py         # Verifies database schema
  .env                 # Your API keys (never commit this)
  music.db             # SQLite database (auto-created on startup)
```

---

## Setup

```bash
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Fill in your keys in .env
# 3. Run
uvicorn backend.main:app --reload
```

`.env` values needed:

| Key | Where to get it |
|---|---|
| `SPOTIFY_CLIENT_ID` | [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | same |
| `SPOTIFY_REDIRECT_URI` | set to `http://localhost:8000/callback` in your Spotify app |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

---

## Auth flow

Spotify requires OAuth. On first run:

1. Visit `http://localhost:8000/auth` — redirects to Spotify login
2. Approve permissions
3. Spotify calls back to `/callback` and stores your token in `.cache`
4. All subsequent requests use that token automatically

---

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/auth` | Start Spotify OAuth |
| `GET` | `/callback` | OAuth callback (Spotify redirects here) |
| `GET` | `/me` | Your Spotify profile |
| `GET` | `/devices` | List available playback devices |
| `GET` | `/search?query=` | Search tracks |
| `GET` | `/top-tracks` | Your top 50 tracks |
| `GET` | `/recommend` | Personalised suggestions based on your taste |
| `POST` | `/play` | Play music via natural language |
| `POST` | `/ask` | Parse a message into a structured intent |

### POST /play

Automatically picks a playback mode based on what you say — shuffle is always on.

| What you say | Mode | What plays |
|---|---|---|
| `"Play Hurt by NewJeans"` | **track** | That specific song |
| `"Play NewJeans"` / `"Play BTS"` | **artist** | Full artist catalogue |
| `"Play lofi"` / `"Play krnb"` | **multi** | ~20 tracks across many artists |

```json
{ "message": "Play hurt by NewJeans" }
```

---

## How the recommender works

1. Fetches your top 20 tracks as a taste signal
2. Searches Spotify for tracks by each of your top artists (candidate pool)
3. Builds a feature vector per track: **artist TF-IDF + duration + popularity**
4. Computes your average taste vector
5. Ranks candidates by **cosine similarity** to your taste vector
6. Returns the top 10 matches

---

## Database

Three tables are created automatically in `music.db` on startup:

| Table | Stores |
|---|---|
| `users` | Spotify user profile (id, name, email, country) |
| `track_history` | Every track played/searched, with timestamp and action type |
| `mood_requests` | Every natural language message sent to `/play` or `/ask` |
