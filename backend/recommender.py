import logging
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler

logger = logging.getLogger(__name__)


class Recommender:
    """
    Content-based recommender built on track metadata.

    Feature vector per track:
      - Artist TF-IDF  : captures genre/artist affinity
      - duration_ms    : normalised to [0, 1]
      - popularity     : normalised to [0, 1]  (0 when unavailable)

    Flow:
      1. build_profile(top_tracks)     → average taste vector
      2. rank_candidates(candidates)   → cosine-ranked list
    """

    def __init__(self):
        self.vectorizer = TfidfVectorizer(analyzer="word", token_pattern=r"[^,]+")
        self.scaler = MinMaxScaler()
        self._profile: np.ndarray | None = None
        self._fitted = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build_profile(self, top_tracks: list[dict[str, Any]]) -> np.ndarray:
        """
        Fit the feature pipeline on the user's top tracks and return
        the averaged taste vector.
        """
        if not top_tracks:
            raise ValueError("top_tracks must not be empty.")

        matrix = self._build_matrix(top_tracks, fit=True)
        self._profile = matrix.mean(axis=0)
        self._fitted = True
        logger.info(
            "Built taste profile from %d top track(s). Feature dim: %d.",
            len(top_tracks),
            self._profile.shape[0],
        )
        return self._profile

    def rank_candidates(
        self,
        candidates: list[dict[str, Any]],
        top_n: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Rank candidate tracks by cosine similarity to the user's taste profile.
        Returns the top_n most similar tracks, each annotated with a score.
        """
        if not self._fitted or self._profile is None:
            raise RuntimeError("Call build_profile() before rank_candidates().")
        if not candidates:
            return []

        matrix = self._build_matrix(candidates, fit=False)
        scores = cosine_similarity(self._profile.reshape(1, -1), matrix)[0]

        ranked = sorted(
            zip(scores, candidates),
            key=lambda x: x[0],
            reverse=True,
        )

        results = []
        for score, track in ranked[:top_n]:
            results.append({**track, "similarity_score": round(float(score), 4)})

        logger.info(
            "Ranked %d candidates → returning top %d.",
            len(candidates),
            len(results),
        )
        return results

    # ------------------------------------------------------------------
    # Feature engineering
    # ------------------------------------------------------------------

    def _build_matrix(
        self,
        tracks: list[dict[str, Any]],
        fit: bool,
    ) -> np.ndarray:
        """
        Build a (n_tracks × n_features) numpy matrix from track metadata.
        """
        artist_docs = [", ".join(t.get("artists", [])) for t in tracks]
        durations    = np.array([[t.get("duration_ms") or 0] for t in tracks], dtype=float)
        popularities = np.array([[t.get("popularity") or 0] for t in tracks], dtype=float)

        # Artist TF-IDF
        if fit:
            artist_matrix = self.vectorizer.fit_transform(artist_docs).toarray()
            numeric = np.hstack([durations, popularities])
            # Avoid fitting scaler on a single row (top-1 edge case)
            if numeric.shape[0] > 1:
                numeric = self.scaler.fit_transform(numeric)
            else:
                numeric = np.zeros_like(numeric)
        else:
            artist_matrix = self.vectorizer.transform(artist_docs).toarray()
            numeric = np.hstack([durations, popularities])
            try:
                numeric = self.scaler.transform(numeric)
            except Exception:
                numeric = np.zeros_like(numeric)

        return np.hstack([artist_matrix, numeric])
