import logging
from typing import Any

import spotipy
from spotipy.oauth2 import SpotifyOAuth

from backend.config import (
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REDIRECT_URI,
)

logger = logging.getLogger(__name__)

SCOPES = (
    "user-read-playback-state "
    "user-modify-playback-state "
    "user-read-currently-playing "
    "user-top-read"
)


class SpotifyClient:
    def __init__(self):
        self.auth_manager = SpotifyOAuth(
            client_id=SPOTIFY_CLIENT_ID,
            client_secret=SPOTIFY_CLIENT_SECRET,
            redirect_uri=SPOTIFY_REDIRECT_URI,
            scope=SCOPES,
            open_browser=False,
        )
        self.client = spotipy.Spotify(auth_manager=self.auth_manager)

    def authenticate(self) -> str:
        """Return the Spotify OAuth authorization URL for the user to visit."""
        auth_url = self.auth_manager.get_authorize_url()
        logger.info("Spotify auth URL generated.")
        return auth_url

    def get_current_user(self) -> dict[str, Any]:
        """Return the current authenticated user's profile."""
        user = self.client.current_user()
        logger.info("Fetched current user: %s", user.get("id"))
        return {
            "id": user.get("id"),
            "display_name": user.get("display_name"),
            "email": user.get("email"),
            "country": user.get("country"),
            "product": user.get("product"),
            "followers": user.get("followers", {}).get("total"),
            "images": [img.get("url") for img in user.get("images", [])],
            "external_url": user.get("external_urls", {}).get("spotify"),
        }

    def list_devices(self) -> list[dict[str, Any]]:
        """Return a list of available Spotify playback devices."""
        response = self.client.devices()
        devices = response.get("devices", [])
        logger.info("Found %d device(s).", len(devices))
        return [
            {
                "id": d.get("id"),
                "name": d.get("name"),
                "type": d.get("type"),
                "is_active": d.get("is_active"),
                "volume_percent": d.get("volume_percent"),
            }
            for d in devices
        ]

    def search_track(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """Search Spotify for tracks matching the query."""
        response = self.client.search(q=query, type="track", limit=limit)
        tracks = response.get("tracks", {}).get("items", [])
        logger.info("Search '%s' returned %d result(s).", query, len(tracks))
        return [self._format_track(t) for t in tracks]

    def search_playlists(self, query: str, limit: int = 1) -> list[str]:
        """
        Search Spotify for playlists matching the query and return track URIs
        from the first matching playlist.
        """
        response = self.client.search(q=query, type="playlist", limit=limit)
        playlists = response.get("playlists", {}).get("items", [])
        if not playlists:
            logger.info("Playlist search '%s' returned no results.", query)
            return []

        playlist = playlists[0]
        playlist_id = playlist.get("id")
        if not playlist_id:
            return []

        tracks_resp = self.client.playlist_items(playlist_id, limit=100)
        items = tracks_resp.get("items", [])
        uris: list[str] = []
        for item in items:
            track = item.get("track") or {}
            uri = track.get("uri")
            if uri:
                uris.append(uri)

        logger.info(
            "Playlist search '%s' using playlist '%s' yielded %d track URIs.",
            query,
            playlist.get("name"),
            len(uris),
        )
        return uris

    def get_top_tracks(
        self,
        limit: int = 50,
        time_range: str = "medium_term",
    ) -> list[dict[str, Any]]:
        """
        Return the current user's top tracks.

        time_range: short_term (4 weeks) | medium_term (6 months) | long_term (all time)
        """
        response = self.client.current_user_top_tracks(limit=limit, time_range=time_range)
        tracks = response.get("items", [])
        logger.info("Fetched %d top track(s) (%s).", len(tracks), time_range)
        return [
            {**self._format_track(t), "rank": i + 1}
            for i, t in enumerate(tracks)
        ]


    # ------------------------------------------------------------------
    # Playback
    # ------------------------------------------------------------------

    def play_uri(
        self,
        uri: str,
        device_id: str | None = None,
    ) -> dict[str, Any]:
        """Play a track directly by Spotify URI (e.g. spotify:track:xxx) with album context for autoplay."""
        if not device_id or device_id.lower() == "string":
            device_id = self._get_active_device_id()

        # Try to fetch album context so Spotify can autoplay subsequent tracks naturally.
        album_uri: str | None = None
        try:
            track = self.client.track(uri)
            album_uri = (track.get("album") or {}).get("uri")
            uri = track.get("uri") or uri
        except Exception:
            logger.warning("Failed to fetch track metadata for %s; falling back to single-track playback.", uri)

        if album_uri:
            self.client.start_playback(
                device_id=device_id,
                context_uri=album_uri,
                offset={"uri": uri},
            )
        else:
            self.client.start_playback(device_id=device_id, uris=[uri])

        self.client.shuffle(state=True, device_id=device_id)
        logger.info("Playing URI %s on device=%s", uri, device_id)
        return {"mode": "track", "device_id": device_id, "shuffle": True}

    def play_track(
        self,
        track: dict[str, Any],
        device_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Play the requested track followed by 30 similar recommendations (radio-style autoplay).
        Shuffle is off so the requested song always plays first.
        """
        if not device_id or device_id.lower() == "string":
            device_id = self._get_active_device_id()

        uri = track.get("uri")
        track_id = track.get("id")
        uris = [uri] if uri else []

        # Build a queue: requested track + up to 30 Spotify recommendations
        if track_id:
            try:
                recs = self.client.recommendations(seed_tracks=[track_id], limit=30)
                rec_uris = [
                    t["uri"]
                    for t in recs.get("tracks", [])
                    if t.get("uri") and t["uri"] != uri
                ]
                uris = uris + rec_uris
                logger.info(
                    "Recommendations for '%s': %d tracks queued.",
                    track.get("name"), len(rec_uris),
                )
            except Exception as exc:
                logger.warning("Recommendations API failed for %r: %s — playing track alone.", track_id, exc)

        self.client.start_playback(device_id=device_id, uris=uris)
        # Shuffle OFF so the requested track always plays first
        self.client.shuffle(state=False, device_id=device_id)

        logger.info("Playing track: '%s' by %s on device=%s",
                    track.get("name"), track.get("artists"), device_id)
        return {"mode": "track", "device_id": device_id, "shuffle": False}

    def play_artist(
        self,
        track: dict[str, Any],
        device_id: str | None = None,
    ) -> dict[str, Any]:
        """Play the primary artist's full catalogue with shuffle on."""
        if not device_id or device_id.lower() == "string":
            device_id = self._get_active_device_id()

        artist_uri = (track.get("artist_uris") or [None])[0]
        if not artist_uri:
            raise ValueError(f"No artist URI found for track: {track.get('name')}")

        self.client.start_playback(device_id=device_id, context_uri=artist_uri)
        self.client.shuffle(state=True, device_id=device_id)

        logger.info("Playing artist context: %s on device=%s", artist_uri, device_id)
        return {"mode": "artist", "artist_uri": artist_uri, "device_id": device_id, "shuffle": True}

    def play_multi_track(
        self,
        tracks: list[dict[str, Any]] | list[str],
        device_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Queue and play a list of tracks from multiple artists (genre/mood searches).

        Accepts either:
        - a list of formatted track dicts (from search_track / get_top_tracks), or
        - a list of raw track URIs (e.g. from a playlist).
        """
        if not device_id or device_id.lower() == "string":
            device_id = self._get_active_device_id()

        if not tracks:
            uris: list[str] = []
            unique_artists: list[str] = []
        elif isinstance(tracks[0], str):
            # Playlist-based: we only know URIs, not artist names.
            uris = [u for u in tracks if u]
            unique_artists = []
        else:
            uris = [t["uri"] for t in tracks if t.get("uri")]
            unique_artists = list({a for t in tracks for a in t.get("artists", [])})

        if uris:
            self.client.start_playback(device_id=device_id, uris=uris)
            self.client.shuffle(state=True, device_id=device_id)

        logger.info(
            "Multi-track: %d tracks, %d artists on device=%s",
            len(uris),
            len(unique_artists),
            device_id,
        )
        return {
            "mode": "multi",
            "device_id": device_id,
            "shuffle": True,
            "track_count": len(uris),
            "artists": unique_artists,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_active_device_id(self) -> str | None:
        """Return the active device ID, falling back to the first available device."""
        devices = self.client.devices().get("devices", [])
        for d in devices:
            if d.get("is_active"):
                logger.info("Using active device: %s (%s)", d["name"], d["id"])
                return d["id"]
        if devices:
            logger.info(
                "No active device — using first available: %s (%s)",
                devices[0]["name"], devices[0]["id"],
            )
            return devices[0]["id"]
        logger.warning("No devices found.")
        return None


    @staticmethod
    def _format_track(track: dict[str, Any]) -> dict[str, Any]:
        artists_raw = track.get("artists", [])
        album_raw = track.get("album", {}) or {}
        album_images = album_raw.get("images", [])
        result = {
            "id": track["id"],
            "name": track["name"],
            "uri": track.get("uri"),
            "artists": [a["name"] for a in artists_raw],
            "artist_uris": [a["uri"] for a in artists_raw if a.get("uri")],
            "album": {
                "name": album_raw.get("name"),
                "uri": album_raw.get("uri"),
                "images": [{"url": img.get("url"), "height": img.get("height"), "width": img.get("width")} for img in album_images],
            },
            "album_uri": album_raw.get("uri"),
            "duration_ms": track.get("duration_ms"),
            "external_url": track.get("external_urls", {}).get("spotify"),
        }
        if track.get("popularity") is not None:
            result["popularity"] = track["popularity"]
        if track.get("preview_url") is not None:
            result["preview_url"] = track["preview_url"]
        return result
