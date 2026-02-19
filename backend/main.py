import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from backend.spotify_client import SpotifyClient
from backend.intent_engine import IntentEngine
from backend.recommender import Recommender
from backend.database import init_db

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



@app.get("/search")
async def search_tracks(query: str, limit: int = 10):
    """Search for tracks on Spotify."""
    spotify: SpotifyClient = app.state.spotify
    results = spotify.search_track(query, limit=limit)
    return {"query": query, "results": results}


class PlayRequest(BaseModel):
    message: str
    device_id: str | None = None

    model_config = {
        "json_schema_extra": {
            "examples": [{"message": "Play hurt by NewJeans", "device_id": None}]
        }
    }


def _resolve_play_query(intent: dict, message: str) -> str:
    """Extract a usable search query from the intent, falling back to the raw message."""
    query = intent.get("query", "").strip()
    if not query or intent.get("action") == "unknown":
        return message.strip()
    return query


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
            return {
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
            return {
                "status": "playing",
                "mode": "artist",
                "artist": track["artists"][0],
                "shuffle": ctx["shuffle"],
                "device_id": ctx["device_id"],
            }

        else:
            # Specific song — play that track with shuffle on
            ctx = spotify.play_track(track, device_id=body.device_id)
            return {
                "status": "playing",
                "mode": "track",
                "track": track["name"],
                "artists": track["artists"],
                "uri": track["uri"],
                "shuffle": ctx["shuffle"],
                "device_id": ctx["device_id"],
            }

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
    return intent


@app.get("/recommend")
async def recommend(
    top_n: int = 10,
    top_tracks_limit: int = 20,
    candidates_limit: int = 50,
    time_range: str = "medium_term",
):
    """
    Return personalised track recommendations.

    Steps:
      1. Fetch the user's top tracks (taste signal)
      2. Seed Spotify recommendations using top track IDs
      3. Build TF-IDF + metadata feature vectors for all tracks
      4. Rank candidates by cosine similarity to user's taste profile
      5. Return top_n results
    """
    spotify: SpotifyClient = app.state.spotify

    try:
        top_tracks = spotify.get_top_tracks(limit=top_tracks_limit, time_range=time_range)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not fetch top tracks: {exc}")

    if not top_tracks:
        raise HTTPException(status_code=404, detail="No top tracks found. Listen to more music first!")

    # Collect unique artists from top tracks and search for their other songs
    # (Spotify's /recommendations API is restricted for new apps since Nov 2024)
    seen_artists: set[str] = set()
    unique_artists: list[str] = []
    for t in top_tracks:
        for artist in t.get("artists", []):
            if artist not in seen_artists:
                seen_artists.add(artist)
                unique_artists.append(artist)

    top_ids = {t["id"] for t in top_tracks}
    candidates: list[dict] = []
    per_artist = max(1, candidates_limit // max(len(unique_artists), 1))

    for artist in unique_artists[:10]:          # cap at 10 artists to stay fast
        try:
            results = spotify.search_track(f"artist:{artist}", limit=per_artist)
            for track in results:
                if track["id"] not in top_ids and track["id"] not in {c["id"] for c in candidates}:
                    candidates.append(track)
        except Exception:
            continue

    if not candidates:
        raise HTTPException(status_code=404, detail="Could not gather candidate tracks.")

    # Build taste profile and rank candidates
    try:
        recommender = Recommender()
        recommender.build_profile(top_tracks)
        ranked = recommender.rank_candidates(candidates, top_n=top_n)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Recommender error: {exc}")

    return {
        "total": len(ranked),
        "based_on": len(top_tracks),
        "time_range": time_range,
        "recommendations": ranked,
    }
