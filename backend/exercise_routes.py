"""
exercise_routes.py – FastAPI endpoints for real-time exercise monitoring.

Endpoints:
  POST /api/exercise/process-frame    – Process a single base64 frame
  GET  /api/exercise/sports-mapping   – Return sport → exercises mapping
  GET  /api/exercise/info/{key}       – Return exercise metadata
  GET  /api/exercise/list             – Return all supported exercises
"""

from __future__ import annotations

import os
import shutil
import logging
import tempfile
from typing import Optional
from pathlib import Path

import cv2
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from cv_module.exercise_tracker import ExerciseState, get_tracker, TRACKER_MAP
from cv_module.pose_detector import PoseDetector
from database.db_manager import DatabaseManager
from utils.helpers import decode_base64_frame

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/exercise")

_db = DatabaseManager()

TIMER_EXERCISES = {"plank"}

# ─── Singleton trackers per session ───────────────────────────────────────────
# Maps session_id → {exercise, tracker} (keeps state across frames)
_active_trackers: dict[int, dict[str, object]] = {}

# Singleton detector for video mode
_detector: Optional[PoseDetector] = None


def _get_detector() -> PoseDetector:
    global _detector
    if _detector is None:
        _detector = PoseDetector(static_image_mode=False)
    return _detector


def _detect_landmarks_with_rotations(detector: PoseDetector, frame):
    """Try the recorded frame in multiple orientations to handle mobile rotation metadata."""
    orientations = [
        frame,
        cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE),
        cv2.rotate(frame, cv2.ROTATE_180),
        cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE),
    ]

    for oriented_frame in orientations:
        landmarks, _ = detector.detect(oriented_frame)
        if landmarks is not None:
            return landmarks
    return None


def _tracker_result_to_dict(result, exercise_key: str) -> dict:
    if isinstance(result, dict):
        data = dict(result)
    elif isinstance(result, ExerciseState):
        data = {
            "exercise": exercise_key,
            "rep_count": result.reps,
            "stage": result.stage,
            "correct_form": result.feedback_level != "error",
            "feedback": result.feedback,
            "feedback_level": result.feedback_level,
            "angles": result.angles,
            "confidence": result.confidence,
        }
    else:
        data = {
            "exercise": exercise_key,
            "rep_count": getattr(result, "reps", 0),
            "stage": getattr(result, "stage", "UNKNOWN"),
            "correct_form": getattr(result, "feedback_level", "info") != "error",
            "feedback": getattr(result, "feedback", ""),
            "feedback_level": getattr(result, "feedback_level", "info"),
            "angles": getattr(result, "angles", {}),
            "confidence": getattr(result, "confidence", 0.0),
        }

    data.setdefault("exercise", exercise_key)
    data.setdefault("rep_count", 0)
    data.setdefault("stage", "UNKNOWN")
    data.setdefault("correct_form", True)
    data.setdefault("feedback", "")
    data.setdefault("feedback_level", "info")
    data.setdefault("angles", {})
    data.setdefault("confidence", 0.0)
    return data


def _get_session_tracker(session_id: int, exercise: str):
    if session_id <= 0:
        return get_tracker(exercise)

    session_tracker = _active_trackers.get(session_id)
    if session_tracker is None or session_tracker.get("exercise") != exercise:
        session_tracker = {
            "exercise": exercise,
            "tracker": get_tracker(exercise),
        }
        _active_trackers[session_id] = session_tracker
    return session_tracker["tracker"]


def _sample_video(video_path: str, exercise: str, tracker, session_id: int = 0) -> dict:
    detector = _get_detector()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Could not open uploaded video.")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    video_duration = frame_count / fps if fps > 0 else 0.0
    sample_every = max(1, int(round(fps / 10.0)))

    processed_frames = 0
    frame_index = 0
    last_result = None
    last_landmarks = None

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_index % sample_every != 0:
                frame_index += 1
                continue

            processed_frames += 1
            landmarks = _detect_landmarks_with_rotations(detector, frame)
            if landmarks is None:
                frame_index += 1
                continue

            last_landmarks = landmarks
            last_result = _tracker_result_to_dict(tracker.update(landmarks), exercise)

            if session_id > 0:
                try:
                    _db.log_exercise_frame(
                        session_id=session_id,
                        rep_count=last_result.get("rep_count", 0),
                        stage=last_result.get("stage", ""),
                        feedback=last_result.get("feedback", ""),
                        confidence=last_result.get("confidence", 0.0),
                        knee_angle=last_result.get("angles", {}).get("knee"),
                        elbow_angle=last_result.get("angles", {}).get("elbow"),
                        torso_angle=last_result.get("angles", {}).get("torso"),
                    )
                except Exception as exc:
                    logger.warning("Failed to log video sample: %s", exc)

            frame_index += 1
    finally:
        cap.release()

    if last_result is None:
        last_result = {
            "exercise": exercise,
            "rep_count": getattr(tracker, "reps", 0),
            "stage": getattr(tracker, "stage", "UNKNOWN"),
            "correct_form": True,
            "feedback": "No pose detected in the video.",
            "feedback_level": "warning",
            "angles": {},
            "confidence": 0.0,
        }

    if exercise in TIMER_EXERCISES:
        last_result["hold_duration"] = round(video_duration, 1)

    if last_landmarks is not None:
        last_result["landmarks"] = {
            name: [round(coords[0], 4), round(coords[1], 4)]
            for name, coords in last_landmarks.items()
        }
    else:
        last_result.setdefault("landmarks", None)

    last_result["video_duration"] = round(video_duration, 1)
    last_result["frames_sampled"] = processed_frames
    return last_result


# ─── Sport → Exercise Mapping (the 12 sports from the spec) ──────────────────

SPORT_EXERCISES = {
    "Football":        ["squat", "lunge", "high_knees", "lateral_shuffle", "burpee"],
    "Basketball":      ["squat", "jump_squat", "high_knees", "lateral_shuffle", "pushup"],
    "Cricket":         ["squat", "lunge", "overhead_throw", "lateral_shuffle", "shoulder_rotation"],
    "Tennis":          ["lunge", "lateral_shuffle", "shoulder_rotation", "arm_circles", "squat"],
    "Badminton":       ["lunge", "lateral_shuffle", "overhead_throw", "high_knees", "arm_circles"],
    "Swimming":        ["pushup", "shoulder_rotation", "arm_circles", "forward_bend", "squat"],
    "Cycling":         ["squat", "lunge", "deep_squat", "forward_bend", "plank"],
    "Running":         ["squat", "lunge", "high_knees", "forward_bend", "plank"],
    "Athletics":       ["squat", "lunge", "high_knees", "burpee", "deep_squat"],
    "Boxing":          ["pushup", "squat", "high_knees", "arm_circles", "burpee"],
    "Volleyball":      ["jump_squat", "squat", "lateral_shuffle", "overhead_throw", "plank"],
    "Field Hockey":    ["squat", "lunge", "lateral_shuffle", "overhead_throw", "deep_squat"],
}

# ─── Exercise Metadata ────────────────────────────────────────────────────────

EXERCISE_INFO = {
    "squat": {
        "key": "squat",
        "name": "Squat",
        "emoji": "🏋️",
        "type": "rep",
        "muscles": "Quadriceps · Glutes · Hamstrings · Core",
        "instructions": "Stand with feet shoulder-width apart. Lower your hips back and down as if sitting in a chair. Keep chest up and knees behind toes. Push through heels to stand.",
        "benefit": "Builds explosive lower-body power and functional strength",
        "target_reps": 12,
        "difficulty": "Beginner",
    },
    "pushup": {
        "key": "pushup",
        "name": "Push-up",
        "emoji": "💪",
        "type": "rep",
        "muscles": "Chest · Triceps · Shoulders · Core",
        "instructions": "Start in plank position. Lower chest to floor by bending elbows. Keep body straight from head to heels. Push back up to start.",
        "benefit": "Builds upper-body push strength and core stability",
        "target_reps": 10,
        "difficulty": "Beginner",
    },
    "lunge": {
        "key": "lunge",
        "name": "Lunge",
        "emoji": "🦵",
        "type": "rep",
        "muscles": "Quadriceps · Glutes · Hamstrings · Hip Flexors",
        "instructions": "Step forward with one leg. Lower until both knees are at 90°. Keep torso upright. Push back to start and alternate legs.",
        "benefit": "Improves unilateral leg strength and balance",
        "target_reps": 10,
        "difficulty": "Beginner",
    },
    "plank": {
        "key": "plank",
        "name": "Plank",
        "emoji": "🧘",
        "type": "timer",
        "muscles": "Core · Shoulders · Back · Glutes",
        "instructions": "Support body on forearms and toes. Keep body straight from shoulders to ankles. Engage core. Hold position without sagging or piking.",
        "benefit": "Builds core endurance and total body stability",
        "target_duration": 30,
        "difficulty": "Beginner",
    },
    "burpee": {
        "key": "burpee",
        "name": "Burpee",
        "emoji": "🔥",
        "type": "rep",
        "muscles": "Full Body · Chest · Legs · Core · Cardio",
        "instructions": "Stand, squat down, kick feet back to plank, do a push-up, jump feet forward, explode up with a jump. That's one rep.",
        "benefit": "Ultimate full-body conditioning and cardiovascular blast",
        "target_reps": 8,
        "difficulty": "Advanced",
    },
    "jump_squat": {
        "key": "jump_squat",
        "name": "Jump Squat",
        "emoji": "🚀",
        "type": "rep",
        "muscles": "Quadriceps · Glutes · Calves · Core",
        "instructions": "Perform a squat, then explode upward into a jump. Land softly with bent knees and immediately go into the next squat.",
        "benefit": "Develops explosive power and plyometric strength",
        "target_reps": 10,
        "difficulty": "Intermediate",
    },
    "overhead_throw": {
        "key": "overhead_throw",
        "name": "Overhead Throw Motion",
        "emoji": "🏐",
        "type": "rep",
        "muscles": "Shoulders · Triceps · Core · Back",
        "instructions": "Wind your arm back behind your head. Drive forward through the throwing motion with full arm extension. Focus on controlled follow-through.",
        "benefit": "Builds sport-specific throwing power and shoulder mobility",
        "target_reps": 10,
        "difficulty": "Intermediate",
    },
    "deep_squat": {
        "key": "deep_squat",
        "name": "Deep Squat (ATG)",
        "emoji": "⬇️",
        "type": "rep",
        "muscles": "Quadriceps · Glutes · Hip Flexors · Ankles",
        "instructions": "Perform a squat going as deep as possible — aim to get hips below knees. Keep heels on the ground and back straight.",
        "benefit": "Maximizes leg strength and hip/ankle mobility",
        "target_reps": 8,
        "difficulty": "Intermediate",
    },
    "high_knees": {
        "key": "high_knees",
        "name": "High Knees",
        "emoji": "🏃",
        "type": "rep",
        "muscles": "Hip Flexors · Quadriceps · Core · Calves",
        "instructions": "Run in place, driving each knee up to hip level. Pump your arms and maintain a quick pace. Keep your core tight.",
        "benefit": "Boosts cardiovascular endurance and hip flexor power",
        "target_reps": 20,
        "difficulty": "Beginner",
    },
    "lateral_shuffle": {
        "key": "lateral_shuffle",
        "name": "Lateral Shuffle",
        "emoji": "↔️",
        "type": "rep",
        "muscles": "Adductors · Abductors · Glutes · Calves",
        "instructions": "Start in athletic stance. Shuffle sideways with quick steps, pushing off with the trailing foot. Keep hips low and stay on the balls of your feet.",
        "benefit": "Develops lateral agility and court/field movement",
        "target_reps": 12,
        "difficulty": "Beginner",
    },
    "arm_circles": {
        "key": "arm_circles",
        "name": "Arm Circles",
        "emoji": "🔄",
        "type": "rep",
        "muscles": "Shoulders · Rotator Cuff · Upper Back",
        "instructions": "Extend arms straight out to the sides. Make controlled circular motions, gradually increasing the size. Keep arms straight throughout.",
        "benefit": "Warms up shoulder joints and improves rotational mobility",
        "target_reps": 15,
        "difficulty": "Beginner",
    },
    "shoulder_rotation": {
        "key": "shoulder_rotation",
        "name": "Shoulder Rotation",
        "emoji": "🔃",
        "type": "rep",
        "muscles": "Shoulders · Rotator Cuff · Trapezius",
        "instructions": "Raise arms overhead in a controlled motion. Lower back down to sides. Focus on full range of motion through the shoulder joint.",
        "benefit": "Prevents shoulder injuries and improves overhead mobility",
        "target_reps": 12,
        "difficulty": "Beginner",
    },
    "forward_bend": {
        "key": "forward_bend",
        "name": "Forward Bend",
        "emoji": "🙇",
        "type": "rep",
        "muscles": "Hamstrings · Lower Back · Glutes · Calves",
        "instructions": "Stand with feet hip-width apart. Hinge at the hips and fold forward, reaching toward the floor. Keep legs as straight as possible. Rise back up slowly.",
        "benefit": "Increases posterior chain flexibility and spinal decompression",
        "target_reps": 10,
        "difficulty": "Beginner",
    },
}


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ProcessFrameRequest(BaseModel):
    frame_b64: str
    exercise: str
    session_id: int = 0  # 0 = no session persistence


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/process-frame", summary="Process a single camera frame for exercise analysis")
def process_frame(req: ProcessFrameRequest):
    """
    Decode a base64 frame, run MediaPipe pose detection,
    then pass landmarks through the exercise tracker.
    Returns rep count, stage, feedback, angles, and form correctness.
    """
    # Validate exercise
    if req.exercise not in TRACKER_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown exercise '{req.exercise}'. Choose from: {list(TRACKER_MAP.keys())}",
        )

    # Decode frame
    try:
        frame = decode_base64_frame(req.frame_b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}")

    tracker = _get_session_tracker(req.session_id, req.exercise)

    # Run pose detection
    detector = _get_detector()
    landmarks, _ = detector.detect(frame)

    if landmarks is None:
        return {
            "status": "ok",
            "result": {
                "exercise": req.exercise,
                "rep_count": tracker.reps,
                "stage": tracker.stage,
                "correct_form": True,
                "feedback": "No pose detected — make sure your full body is visible",
                "feedback_level": "warning",
                "angles": {},
                "confidence": 0.0,
                "landmarks": None,
            },
        }

    # Process frame through tracker
    result = _tracker_result_to_dict(tracker.update(landmarks), req.exercise)

    # Build normalized landmark list (0-1 range) for frontend skeleton overlay
    h, w = frame.shape[:2]
    norm_landmarks = {}
    for name, coords in landmarks.items():
        norm_landmarks[name] = [
            round(coords[0] / w, 4),   # x normalized
            round(coords[1] / h, 4),   # y normalized
        ]
    result["landmarks"] = norm_landmarks

    # Log to DB if session is active
    if req.session_id > 0:
        try:
            _db.log_exercise_frame(
                session_id=req.session_id,
                rep_count=result.get("rep_count", 0),
                stage=result.get("stage", ""),
                feedback=result.get("feedback", ""),
                confidence=result.get("confidence", 0.0),
                knee_angle=result.get("angles", {}).get("knee"),
                elbow_angle=result.get("angles", {}).get("elbow"),
                torso_angle=result.get("angles", {}).get("torso"),
            )
        except Exception as e:
            logger.warning("Failed to log frame: %s", e)

    return {"status": "ok", "result": result}


@router.post("/process-video", summary="Process a recorded exercise video")
async def process_video(
    exercise: str = Form(...),
    session_id: int = Form(0),
    video_file: UploadFile = File(...),
):
    """Sample frames from a recorded video and aggregate the exercise result."""
    if exercise not in TRACKER_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown exercise '{exercise}'. Choose from: {list(TRACKER_MAP.keys())}",
        )

    suffix = Path(video_file.filename or "exercise.mp4").suffix or ".mp4"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_path = tmp.name
            shutil.copyfileobj(video_file.file, tmp)

        tracker = _get_session_tracker(session_id, exercise)
        result = _sample_video(temp_path, exercise, tracker, session_id=session_id)
        return {"status": "ok", "result": result}
    finally:
        try:
            await video_file.close()
        except Exception:
            pass
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                logger.warning("Failed to remove temp video file: %s", temp_path)


@router.get("/sports-mapping", summary="Get sport → exercises mapping")
def sports_mapping():
    """Return the full mapping of sports to their recommended exercises."""
    return {"status": "ok", "mapping": SPORT_EXERCISES}


@router.get("/list", summary="List all supported exercises")
def list_exercises():
    """Return metadata for all 13 supported exercises."""
    return {"status": "ok", "exercises": EXERCISE_INFO}


@router.get("/info/{exercise_key}", summary="Get exercise metadata")
def exercise_info(exercise_key: str):
    """Return detailed metadata for a specific exercise."""
    info = EXERCISE_INFO.get(exercise_key)
    if info is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown exercise '{exercise_key}'. Choose from: {list(EXERCISE_INFO.keys())}",
        )
    return {"status": "ok", "exercise": info}


@router.post("/reset-tracker/{session_id}", summary="Reset a session tracker")
def reset_tracker(session_id: int):
    """Reset the tracker state for a given session."""
    if session_id in _active_trackers:
        tracker = _active_trackers[session_id].get("tracker")
        if tracker is not None and hasattr(tracker, "reset"):
            tracker.reset()
        del _active_trackers[session_id]
    return {"status": "ok"}
