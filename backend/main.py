import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from backend.spotify_client import SpotifyClient
from backend.intent_engine import IntentEngine
from backend.database import init_db, get_session
from backend.models import MoodRequest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up AI Music Assistant...")
    init_db()
    app.state.spotify = SpotifyClient()
    app.state.intent = IntentEngine()
    logger.info("Spotify client and intent engine initialized.")
    yield
    logger.info("Shutting down AI Music Assistant.")


app = FastAPI(
    title="AI Music Assistant",
    description="An AI-powered music assistant backed by Spotify and OpenAI.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": "AI Music Assistant"}


@app.get("/auth")
async def auth():
    """Redirect the user to Spotify's OAuth authorization page."""
    spotify: SpotifyClient = app.state.spotify
    auth_url = spotify.authenticate()
    return RedirectResponse(url=auth_url)


@app.get("/callback")
async def callback(request: Request, code: str | None = None, error: str | None = None):
    """Spotify OAuth callback — exchanges the authorization code for tokens."""
    if error:
        raise HTTPException(status_code=400, detail=f"Spotify auth error: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")
    spotify: SpotifyClient = app.state.spotify
    spotify.auth_manager.get_access_token(code, as_dict=False)
    logger.info("Spotify OAuth token obtained via callback.")
    return {"status": "authenticated"}


@app.get("/me")
async def get_current_user():
    """Return the authenticated Spotify user's profile."""
    spotify: SpotifyClient = app.state.spotify
    try:
        user = spotify.get_current_user()
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return user


@app.get("/devices")
async def list_devices():
    """Return available Spotify playback devices."""
    spotify: SpotifyClient = app.state.spotify
    try:
        devices = spotify.list_devices()
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return {"devices": devices}


@app.get("/top-tracks")
async def top_tracks(limit: int = 50, time_range: str = "medium_term"):
    """
    Return the current user's top tracks.
    time_range: short_term | medium_term | long_term
    """
    spotify: SpotifyClient = app.state.spotify
    try:
        tracks = spotify.get_top_tracks(limit=limit, time_range=time_range)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"total": len(tracks), "time_range": time_range, "tracks": tracks}



class PlayRequest(BaseModel):
    message: str
    device_id: str | None = None

    model_config = {
        "json_schema_extra": {
            "examples": [{"message": "Play hurt by NewJeans", "device_id": None}]
        }
    }


class PlayTrackRequest(BaseModel):
    uri: str
    device_id: str | None = None


def _save_mood_request(
    message: str,
    intent: dict,
    resolved_query: str | None = None,
    *,
    mode: str | None = None,
) -> None:
    """Persist a mood request to the database for the voice UI."""
    action = mode if mode else intent.get("action")
    try:
        with get_session() as session:
            session.add(MoodRequest(
                user_id=None,
                message=message,
                resolved_action=action,
                resolved_query=resolved_query,
                intent_source=intent.get("source"),
            ))
    except Exception as exc:
        logger.warning("Failed to save mood request: %s", exc)


def _resolve_play_query(intent: dict, message: str) -> str:
    """Extract a usable search query from the intent, falling back to the raw message."""
    query = intent.get("query", "").strip()
    if not query or intent.get("action") == "unknown":
        return message.strip()
    return query


@app.post("/play-track")
async def play_track_by_uri(body: PlayTrackRequest):
    """Play a specific track by Spotify URI (e.g. spotify:track:xxx)."""
    spotify: SpotifyClient = app.state.spotify
    if not body.uri or not body.uri.strip().startswith("spotify:track:"):
        raise HTTPException(status_code=400, detail="Invalid track URI. Use spotify:track:xxx")
    try:
        ctx = spotify.play_uri(body.uri.strip(), device_id=body.device_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "playing", "uri": body.uri, **ctx}


@app.post("/play")
async def play_track(body: PlayRequest):
    """
    Natural language → one of three playback modes (all with shuffle on):

    - **track**  — a specific song is named (e.g. "Play Hurt by NewJeans")
    - **artist** — only an artist is named  (e.g. "Play NewJeans", "Play BTS")
    - **multi**  — genre/mood query         (e.g. "Play lofi", "Play krnb")
    """
    spotify: SpotifyClient = app.state.spotify
    intent_engine: IntentEngine = app.state.intent

    try:
        intent = intent_engine.parse(body.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Intent engine error: {exc}")

    query = _resolve_play_query(intent, body.message)
    logger.info("Resolved intent: %s | query: %r", intent, query)

    results = spotify.search_track(query, limit=10)
    if not results:
        raise HTTPException(status_code=404, detail=f"No tracks found for: '{query}'")

    track = results[0]
    query_words = set(query.lower().split())
    top_artist_words = set((track["artists"][0] if track.get("artists") else "").lower().split())
    track_name_words = set(track["name"].lower().split())

    artist_named = bool(top_artist_words & query_words)

    if not artist_named:
        # Genre/mood query — widen the pool with a second search
        extra = spotify.search_track(f"{query} mix", limit=10)
        seen = {t["id"] for t in results}
        results += [t for t in extra if t["id"] not in seen]
        unique_artists = {a for t in results for a in t.get("artists", [])}
        is_diverse = len(unique_artists) >= 2
    else:
        is_diverse = False

    try:
        if is_diverse:
            # Genre/mood — queue everything, let Spotify shuffle
            ctx = spotify.play_multi_track(results, device_id=body.device_id)
            resp = {
                "status": "playing",
                "mode": "multi",
                "track_count": ctx["track_count"],
                "artists": ctx["artists"],
                "shuffle": ctx["shuffle"],
                "device_id": ctx["device_id"],
            }

        elif artist_named and not (track_name_words & query_words):
            # Only artist name in query — play full artist catalogue
            ctx = spotify.play_artist(track, device_id=body.device_id)
            resp = {
                "status": "playing",
                "mode": "artist",
                "artist": track["artists"][0],
                "shuffle": ctx["shuffle"],
                "device_id": ctx["device_id"],
            }

        else:
            # Specific song — play that track with shuffle on
            ctx = spotify.play_track(track, device_id=body.device_id)
            resp = {
                "status": "playing",
                "mode": "track",
                "track": track["name"],
                "artists": track["artists"],
                "uri": track["uri"],
                "shuffle": ctx["shuffle"],
                "device_id": ctx["device_id"],
            }

        _save_mood_request(body.message, intent, query, mode=resp.get("mode"))
        return resp

    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))



class AskRequest(BaseModel):
    message: str


@app.post("/ask")
async def ask(body: AskRequest):
    """Parse a natural language message and return the resolved intent."""
    intent_engine: IntentEngine = app.state.intent
    try:
        intent = intent_engine.parse(body.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _save_mood_request(body.message, intent, intent.get("query"))
    return intent


@app.get("/latest-command")
async def get_latest_command():
    """
    Return the most recent voice/text command (for frontend polling).
    Shows what the user just said via voice or typed.
    """
    from sqlalchemy import desc, select

    with get_session() as session:
        result = session.execute(
            select(MoodRequest).order_by(desc(MoodRequest.created_at)).limit(1)
        )
        row = result.scalars().first()
    if not row:
        return {"latest": None}
    return {
        "latest": {
            "id": row.id,
            "message": row.message,
            "resolved_action": row.resolved_action,
            "resolved_query": row.resolved_query,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
    }


@app.get("/mood-requests")
async def get_mood_requests(limit: int = 5):
    """
    Return the latest mood requests (voice/text commands and their resolved intents).
    Used by the frontend VoiceAssistant for real-time display.
    """
    from sqlalchemy import desc, select

    with get_session() as session:
        result = session.execute(
            select(MoodRequest).order_by(desc(MoodRequest.created_at)).limit(limit)
        )
        items = result.scalars().all()
    return {
        "requests": [
            {
                "id": r.id,
                "message": r.message,
                "resolved_action": r.resolved_action,
                "resolved_query": r.resolved_query,
                "intent_source": r.intent_source,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in items
        ],
    }


