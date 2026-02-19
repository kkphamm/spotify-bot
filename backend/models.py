from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """Spotify user profile, keyed by their Spotify user ID."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    spotify_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    display_name: Mapped[str | None] = mapped_column(String(128))
    email: Mapped[str | None] = mapped_column(String(256))
    country: Mapped[str | None] = mapped_column(String(8))
    product: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    track_history: Mapped[list["TrackHistory"]] = relationship(
        "TrackHistory", back_populates="user", cascade="all, delete-orphan"
    )
    mood_requests: Mapped[list["MoodRequest"]] = relationship(
        "MoodRequest", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User spotify_id={self.spotify_id!r} name={self.display_name!r}>"


class TrackHistory(Base):
    """A track that was played or searched by a user."""

    __tablename__ = "track_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    spotify_track_id: Mapped[str] = mapped_column(String(64), nullable=False)
    track_name: Mapped[str] = mapped_column(String(256), nullable=False)
    artists: Mapped[str] = mapped_column(String(512), nullable=False)  # comma-separated
    album: Mapped[str | None] = mapped_column(String(256))
    uri: Mapped[str | None] = mapped_column(String(128))
    action: Mapped[str] = mapped_column(String(32), default="play")  # play | search | recommend
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship("User", back_populates="track_history")

    def __repr__(self) -> str:
        return f"<TrackHistory track={self.track_name!r} action={self.action!r}>"


class MoodRequest(Base):
    """A natural language message the user sent to the intent engine."""

    __tablename__ = "mood_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    resolved_action: Mapped[str | None] = mapped_column(String(64))
    resolved_query: Mapped[str | None] = mapped_column(String(256))
    intent_source: Mapped[str | None] = mapped_column(String(32))  # openai | fallback
    similarity_score: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User | None"] = relationship("User", back_populates="mood_requests")

    def __repr__(self) -> str:
        return f"<MoodRequest message={self.message[:40]!r} action={self.resolved_action!r}>"
