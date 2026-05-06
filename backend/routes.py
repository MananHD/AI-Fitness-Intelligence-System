"""
routes.py – All FastAPI endpoint definitions for the fitness AI system.

Endpoints:
  POST /api/users                    – create / get user
  GET  /api/users/{user_id}          – get user profile
  GET  /api/users                    – list all users

  POST /api/analyze-body             – BMI + body type from image + metadata
  POST /api/recommend-sport          – sport recommendations
  POST /api/recommend-diet           – daily meal plan

  POST /api/sessions/start           – start workout session
  POST /api/sessions/{id}/end        – end session
  GET  /api/sessions/{id}            – session detail
  GET  /api/sessions/{id}/logs       – exercise frame logs

  GET  /api/progress/{user_id}       – progress history
  GET  /api/users/{user_id}/summary  – dashboard summary
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from cv_module.body_analysis import full_body_analysis
from cv_module.pose_detector import PoseDetector
from database.db_manager import DatabaseManager
from recommendation.diet_planner import DietPlanner
from recommendation.sport_recommender import SportRecommender
from utils.helpers import decode_base64_frame

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# ─── Singletons ───────────────────────────────────────────────────────────────
_db   = DatabaseManager()
_sport = SportRecommender()
_diet  = DietPlanner()


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class UserCreateRequest(BaseModel):
    username:   str
    age:        Optional[int]   = None
    height_cm:  Optional[float] = None
    weight_kg:  Optional[float] = None
    diet_pref:  str             = "veg"
    gender:     str             = "male"


class AnalyzeBodyRequest(BaseModel):
    frame_b64:  str             # base64-encoded JPEG frame
    weight_kg:  float           = Field(gt=0)
    height_cm:  float           = Field(gt=0)
    user_id:    Optional[int]   = None


class SportRecommendRequest(BaseModel):
    bmi_category: str
    body_type:    str
    user_id:      Optional[int] = None


class DietRequest(BaseModel):
    bmi_category:      str
    sport:             str
    sport_intensity:   str   = "Moderate"
    dietary_preference: str  = "veg"
    weight_kg:         float = Field(gt=0)


class StartSessionRequest(BaseModel):
    user_id:  int
    exercise: str   # squat | pushup | jumping_jack


class EndSessionRequest(BaseModel):
    total_reps: int


# ─── Users ────────────────────────────────────────────────────────────────────

@router.post("/users", summary="Create or retrieve a user")
def create_user(req: UserCreateRequest):
    """
    Create a new user or return existing one if username already exists.
    """
    user = _db.get_or_create_user(
        req.username,
        age=req.age,
        height_cm=req.height_cm,
        weight_kg=req.weight_kg,
        diet_pref=req.diet_pref,
        gender=req.gender,
    )
    return {"status": "ok", "user": user}


@router.get("/users", summary="List all users")
def list_users():
    return {"users": _db.list_users()}


@router.get("/users/{user_id}", summary="Get a user profile")
def get_user(user_id: int):
    user = _db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user": user}


@router.get("/users/{user_id}/summary", summary="Dashboard summary for a user")
def user_summary(user_id: int):
    summary = _db.get_user_summary(user_id)
    if not summary:
        raise HTTPException(status_code=404, detail="User not found.")
    return summary


# ─── Body Analysis ────────────────────────────────────────────────────────────

@router.post("/analyze-body", summary="Analyse body from a base64 frame + metadata")
def analyze_body(req: AnalyzeBodyRequest):
    """
    Decode an image frame, run pose detection, and compute:
      - BMI + WHO category
      - Shoulder-hip ratio  (CV)
      - Combined body type + confidence
    """
    try:
        frame = decode_base64_frame(req.frame_b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}")

    detector = PoseDetector(static_image_mode=True)
    landmarks, _ = detector.detect_static(frame)
    detector.close()

    result = full_body_analysis(landmarks, req.weight_kg, req.height_cm)

    # Optionally persist
    if req.user_id:
        _db.update_user_analysis(
            req.user_id,
            req.weight_kg,
            result.bmi_result.bmi,
            result.bmi_result.category,
            result.body_type,
        )
        _db.save_progress_snapshot(
            req.user_id,
            req.weight_kg,
            result.bmi_result.bmi,
            result.bmi_result.category,
        )

    return {"status": "ok", "analysis": result.to_dict()}


# ─── Sport Recommendation ─────────────────────────────────────────────────────

@router.post("/recommend-sport", summary="Get sport recommendations")
def recommend_sport(req: SportRecommendRequest):
    """
    Return ranked sport recommendations based on BMI category and body type.
    """
    recommendations = _sport.recommend_as_dicts(req.bmi_category, req.body_type)
    return {"status": "ok", "recommendations": recommendations}


# ─── Diet Recommendation ──────────────────────────────────────────────────────

@router.post("/recommend-diet", summary="Generate a daily meal plan")
def recommend_diet(req: DietRequest):
    """
    Generate a structured daily meal plan.
    """
    try:
        plan = _diet.plan_as_dict(
            req.bmi_category,
            req.sport,
            req.sport_intensity,
            req.dietary_preference,
            req.weight_kg,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"status": "ok", "meal_plan": plan}


# ─── Sessions ─────────────────────────────────────────────────────────────────

@router.post("/sessions/start", summary="Start a workout session")
def start_session(req: StartSessionRequest):
    user = _db.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    session_id = _db.start_session(req.user_id, req.exercise)
    return {"status": "ok", "session_id": session_id}


@router.post("/sessions/{session_id}/end", summary="End a workout session")
def end_session(session_id: int, req: EndSessionRequest):
    session = _db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    _db.end_session(session_id, req.total_reps)
    return {"status": "ok", "session": _db.get_session(session_id)}


@router.get("/sessions/{session_id}", summary="Get session details")
def get_session(session_id: int):
    session = _db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"session": session}


@router.get("/sessions/{session_id}/logs", summary="Get frame-level exercise logs")
def get_session_logs(session_id: int):
    return {"logs": _db.get_session_logs(session_id)}


# ─── Progress ─────────────────────────────────────────────────────────────────

@router.get("/progress/{user_id}", summary="Progress history for charts")
def get_progress(user_id: int, limit: int = 30):
    history = _db.get_progress_history(user_id, limit)
    sessions = _db.get_sessions_for_user(user_id, limit)
    return {
        "status": "ok",
        "snapshots": history,
        "sessions":  sessions,
    }


# ─── Health Check ─────────────────────────────────────────────────────────────

@router.get("/health", summary="System health check")
def health():
    return {"status": "healthy", "service": "AI Fitness Intelligence API"}
