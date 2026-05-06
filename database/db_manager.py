"""
db_manager.py – SQLite persistence layer for the fitness AI system.

Tables:
  • users              – user profiles
  • sessions           – workout sessions
  • exercise_logs      – per-frame/per-set exercise data
  • progress_snapshots – periodic weight/BMI snapshots

All public methods return plain Python dicts or lists for easy JSON serialisation.
"""

from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from utils.helpers import load_config

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Schema ───────────────────────────────────────────────────────────────────

_DDL = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    age         INTEGER,
    height_cm   REAL,
    weight_kg   REAL,
    bmi         REAL,
    bmi_category TEXT,
    body_type   TEXT,
    diet_pref   TEXT    DEFAULT 'veg',
    gender      TEXT    DEFAULT 'male',
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise    TEXT    NOT NULL,
    started_at  TEXT    NOT NULL,
    ended_at    TEXT,
    total_reps  INTEGER DEFAULT 0,
    duration_s  INTEGER DEFAULT 0,
    notes       TEXT
);

CREATE TABLE IF NOT EXISTS exercise_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp   TEXT    NOT NULL,
    rep_count   INTEGER,
    stage       TEXT,
    feedback    TEXT,
    knee_angle  REAL,
    elbow_angle REAL,
    torso_angle REAL,
    confidence  REAL
);

CREATE TABLE IF NOT EXISTS progress_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_at TEXT    NOT NULL,
    weight_kg   REAL,
    bmi         REAL,
    bmi_category TEXT,
    reps_total  INTEGER DEFAULT 0,
    sessions_count INTEGER DEFAULT 0
);
"""


class DatabaseManager:
    """
    Thin SQLite wrapper providing CRUD operations for all four tables.

    Usage:
        db = DatabaseManager()
        db.init_db()
        user_id = db.create_user("alice", age=25, height_cm=165, weight_kg=58)
    """

    def __init__(self, db_path: Optional[str] = None) -> None:
        cfg = load_config().get("database", {})
        path_str = db_path or cfg.get("path", "database/fitness.db")
        self._db_path = Path(path_str)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info("DatabaseManager using: %s", self._db_path.resolve())

    # ─── Context Manager ──────────────────────────────────────────────────────

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(str(self._db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    # ─── Init ─────────────────────────────────────────────────────────────────

    def init_db(self) -> None:
        """Create all tables if they do not already exist."""
        with self._conn() as conn:
            conn.executescript(_DDL)
        # Safe migration: add gender column to existing databases
        try:
            with self._conn() as conn:
                conn.execute("ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'male'")
        except Exception:
            pass  # Column already exists — no action needed
        logger.info("Database schema initialised.")

    # ─── Users ────────────────────────────────────────────────────────────────

    def create_user(
        self,
        username: str,
        age: Optional[int] = None,
        height_cm: Optional[float] = None,
        weight_kg: Optional[float] = None,
        diet_pref: str = "veg",
        gender: str = "male",
    ) -> int:
        """
        Insert a new user record.

        Returns:
            The new user's integer ID.
        """
        now = _now_iso()
        with self._conn() as conn:
            cur = conn.execute(
                """INSERT INTO users
                   (username, age, height_cm, weight_kg, diet_pref, gender, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (username, age, height_cm, weight_kg, diet_pref, gender, now, now),
            )
            return cur.lastrowid  # type: ignore[return-value]

    def get_user(self, user_id: int) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(row) if row else None

    def get_user_by_username(self, username: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()
            return dict(row) if row else None

    def get_or_create_user(self, username: str, **kwargs) -> dict:
        """Return existing user or create a new one."""
        user = self.get_user_by_username(username)
        if user:
            return user
        uid = self.create_user(username, **kwargs)
        return self.get_user(uid)  # type: ignore[return-value]

    def update_user_analysis(
        self,
        user_id: int,
        weight_kg: float,
        bmi: float,
        bmi_category: str,
        body_type: str,
    ) -> None:
        """Update BMI and body analysis fields for a user."""
        with self._conn() as conn:
            conn.execute(
                """UPDATE users SET weight_kg=?, bmi=?, bmi_category=?,
                   body_type=?, updated_at=? WHERE id=?""",
                (weight_kg, bmi, bmi_category, body_type, _now_iso(), user_id),
            )

    def list_users(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
            return [dict(r) for r in rows]

    # ─── Sessions ─────────────────────────────────────────────────────────────

    def start_session(self, user_id: int, exercise: str) -> int:
        """Create a new workout session and return its ID."""
        with self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO sessions (user_id, exercise, started_at) VALUES (?, ?, ?)",
                (user_id, exercise, _now_iso()),
            )
            return cur.lastrowid  # type: ignore[return-value]

    def end_session(self, session_id: int, total_reps: int) -> None:
        """Mark a session as complete and record final rep count."""
        with self._conn() as conn:
            started = conn.execute(
                "SELECT started_at FROM sessions WHERE id=?", (session_id,)
            ).fetchone()
            duration = 0
            if started:
                t0 = datetime.fromisoformat(started["started_at"])
                t1 = datetime.now(timezone.utc)
                duration = int((t1 - t0).total_seconds())
            conn.execute(
                """UPDATE sessions SET ended_at=?, total_reps=?, duration_s=?
                   WHERE id=?""",
                (_now_iso(), total_reps, duration, session_id),
            )

    def get_session(self, session_id: int) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE id=?", (session_id,)
            ).fetchone()
            return dict(row) if row else None

    def get_sessions_for_user(self, user_id: int, limit: int = 20) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM sessions WHERE user_id=? ORDER BY started_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
            return [dict(r) for r in rows]

    # ─── Exercise Logs ────────────────────────────────────────────────────────

    def log_exercise_frame(
        self,
        session_id: int,
        rep_count: int,
        stage: str,
        feedback: str,
        confidence: float,
        knee_angle: Optional[float] = None,
        elbow_angle: Optional[float] = None,
        torso_angle: Optional[float] = None,
    ) -> None:
        """Append one frame's worth of exercise data to the log."""
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO exercise_logs
                   (session_id, timestamp, rep_count, stage, feedback,
                    knee_angle, elbow_angle, torso_angle, confidence)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    session_id, _now_iso(), rep_count, stage, feedback,
                    knee_angle, elbow_angle, torso_angle, confidence,
                ),
            )

    def get_session_logs(self, session_id: int) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM exercise_logs WHERE session_id=? ORDER BY timestamp",
                (session_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    # ─── Progress Snapshots ───────────────────────────────────────────────────

    def save_progress_snapshot(
        self,
        user_id: int,
        weight_kg: float,
        bmi: float,
        bmi_category: str,
    ) -> None:
        """Record a point-in-time progress snapshot for a user."""
        # Count lifetime reps and sessions
        with self._conn() as conn:
            reps_row = conn.execute(
                """SELECT COALESCE(SUM(total_reps), 0) as total
                   FROM sessions WHERE user_id=?""",
                (user_id,),
            ).fetchone()
            sess_row = conn.execute(
                "SELECT COUNT(*) as cnt FROM sessions WHERE user_id=?", (user_id,)
            ).fetchone()

            conn.execute(
                """INSERT INTO progress_snapshots
                   (user_id, recorded_at, weight_kg, bmi, bmi_category,
                    reps_total, sessions_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_id, _now_iso(), weight_kg, bmi, bmi_category,
                    reps_row["total"], sess_row["cnt"],
                ),
            )

    def get_progress_history(self, user_id: int, limit: int = 30) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT * FROM progress_snapshots
                   WHERE user_id=? ORDER BY recorded_at DESC LIMIT ?""",
                (user_id, limit),
            ).fetchall()
            return [dict(r) for r in rows]

    # ─── Dashboard Summary ────────────────────────────────────────────────────

    def get_user_summary(self, user_id: int) -> dict[str, Any]:
        """Return aggregated statistics for a user's dashboard."""
        with self._conn() as conn:
            user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
            if not user:
                return {}

            reps_row = conn.execute(
                "SELECT COALESCE(SUM(total_reps),0) as t FROM sessions WHERE user_id=?",
                (user_id,),
            ).fetchone()
            sess_row = conn.execute(
                "SELECT COUNT(*) as c FROM sessions WHERE user_id=?", (user_id,)
            ).fetchone()
            dur_row = conn.execute(
                "SELECT COALESCE(SUM(duration_s),0) as d FROM sessions WHERE user_id=?",
                (user_id,),
            ).fetchone()

        return {
            "user": dict(user),
            "total_reps":      reps_row["t"],
            "total_sessions":  sess_row["c"],
            "total_duration_s": dur_row["d"],
        }
