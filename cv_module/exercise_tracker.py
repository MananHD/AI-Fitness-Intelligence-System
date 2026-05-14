"""
exercise_tracker.py – Real-time exercise rep counting with state machines.

Implements three exercises using pose landmarks + angle logic:
  • SquatTracker
  • PushupTracker
  • JumpingJackTracker

Each tracker exposes:
    update(landmarks) → ExerciseState (reps, stage, feedback, confidence)

State machine: UNKNOWN → UP → DOWN → UP  (one rep per full cycle)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from utils.helpers import load_config
from cv_module.angle_utils import (
    calculate_angle,
    get_elbow_angle,
    get_knee_angle,
    get_shoulder_angle,
    get_shoulder_width,
    get_ankle_width,
    get_torso_angle,
    get_hip_angle,
)
from cv_module.exercises.arm_circles_tracker import ArmCirclesTracker
from cv_module.exercises.burpee_tracker import BurpeeTracker
from cv_module.exercises.deep_squat_tracker import DeepSquatTracker
from cv_module.exercises.forward_bend_tracker import ForwardBendTracker
from cv_module.exercises.high_knees_tracker import HighKneesTracker
from cv_module.exercises.jump_squat_tracker import JumpSquatTracker
from cv_module.exercises.lateral_shuffle_tracker import LateralShuffleTracker
from cv_module.exercises.lunge_tracker import LungeTracker
from cv_module.exercises.overhead_throw_tracker import OverheadThrowTracker
from cv_module.exercises.plank_tracker import PlankTracker
from cv_module.exercises.shoulder_rotation_tracker import ShoulderRotationTracker

logger = logging.getLogger(__name__)
_cfg = load_config().get("exercises", {})


# ─── Shared Types ─────────────────────────────────────────────────────────────

class Stage(str, Enum):
    UNKNOWN = "UNKNOWN"
    UP      = "UP"
    DOWN    = "DOWN"


@dataclass
class ExerciseState:
    """Snapshot of exercise state after processing a single frame."""
    reps: int           = 0
    stage: str          = Stage.UNKNOWN
    feedback: str       = ""
    feedback_level: str = "info"    # "info" | "warning" | "error"
    confidence: float   = 0.0       # 0.0–1.0  (fraction of keypoints visible)
    angles: dict        = field(default_factory=dict)   # debug: visible angles


# ─── Base Tracker ─────────────────────────────────────────────────────────────

class _BaseTracker:
    """Common counter logic for all exercise trackers."""

    def __init__(self) -> None:
        self._reps: int = 0
        self._stage: str = Stage.DOWN
        self._last_state = ExerciseState()

    def reset(self) -> None:
        """Reset rep counter and stage."""
        self._reps = 0
        self._stage = Stage.DOWN
        self._last_state = ExerciseState()

    @property
    def reps(self) -> int:
        return self._reps

    @property
    def stage(self) -> str:
        return self._stage

    def _count_rep(self, new_stage: str) -> bool:
        """
        Advance the state machine and count a rep when the cycle completes.

        A rep is counted when:  DOWN → UP transition occurs.

        Returns True if a rep was just counted.
        """
        if new_stage == self._stage:
            return False

        if new_stage == Stage.DOWN:
            self._stage = Stage.DOWN
            return False

        if new_stage == Stage.UP and self._stage == Stage.DOWN:
            self._stage = Stage.UP
            self._reps += 1
            return True

        self._stage = new_stage
        return False


# ─── Squat Tracker ────────────────────────────────────────────────────────────

class SquatTracker(_BaseTracker):
    """
    Rep counter for squats.

    Detection logic:
        • Uses the average of left + right knee angles.
        • DOWN when knee_angle < down_threshold  (deep squat).
        • UP   when knee_angle > up_threshold    (standing).
        • Warns if torso leans > back_angle_max  (back straight cue).
    """

    def __init__(self) -> None:
        super().__init__()
        cfg = _cfg.get("squat", {})
        self._down_thresh  = cfg.get("down_angle", 90)
        self._up_thresh    = cfg.get("up_angle", 160)
        self._back_max     = cfg.get("back_angle_max", 50)

    def update(self, landmarks: dict) -> ExerciseState:
        """
        Process one frame and return updated ExerciseState.

        Args:
            landmarks: Dict from PoseDetector.detect().

        Returns:
            ExerciseState with reps, stage, and real-time feedback.
        """
        l_knee = get_knee_angle(landmarks, "left")
        r_knee = get_knee_angle(landmarks, "right")
        torso  = get_torso_angle(landmarks)

        available = [a for a in [l_knee, r_knee] if a is not None]
        if not available:
            return ExerciseState(
                reps=self._reps, stage=self._stage,
                feedback="No lower body detected", feedback_level="warning",
                confidence=0.0,
            )

        knee_angle = sum(available) / len(available)
        confidence = len(available) / 2.0

        # State transition
        if knee_angle < self._down_thresh:
            self._count_rep(Stage.DOWN)
        elif knee_angle > self._up_thresh:
            self._count_rep(Stage.UP)

        # Feedback
        feedback, level = self._build_feedback(knee_angle, torso)

        return ExerciseState(
            reps=self._reps,
            stage=self._stage,
            feedback=feedback,
            feedback_level=level,
            confidence=confidence,
            angles={"knee": round(knee_angle, 1), "torso": torso},
        )

    def _build_feedback(self, knee_angle: float, torso: Optional[float]) -> tuple[str, str]:
        if self._stage == Stage.DOWN and knee_angle > self._down_thresh + 15:
            return "Go lower!", "warning"
        if torso is not None and torso > self._back_max:
            return "Keep your back straight!", "error"
        if self._stage == Stage.UP:
            return "Great squat! Go down.", "info"
        if self._stage == Stage.DOWN:
            return "Good depth! Push back up.", "info"
        return "Start squatting – bend your knees.", "info"


# ─── Pushup Tracker ───────────────────────────────────────────────────────────

class PushupTracker(_BaseTracker):
    """
    Rep counter for push-ups.

    Detection logic:
        • Uses average of left + right elbow angles.
        • DOWN when elbow_angle < down_threshold  (chest near floor).
        • UP   when elbow_angle > up_threshold    (arms extended).
        • Checks shoulder alignment to flag body sag.
    """

    def __init__(self) -> None:
        super().__init__()
        cfg = _cfg.get("pushup", {})
        self._down_thresh = cfg.get("down_angle", 90)
        self._up_thresh   = cfg.get("up_angle", 160)

    def update(self, landmarks: dict) -> ExerciseState:
        l_elbow = get_elbow_angle(landmarks, "left")
        r_elbow = get_elbow_angle(landmarks, "right")

        available = [a for a in [l_elbow, r_elbow] if a is not None]
        if not available:
            return ExerciseState(
                reps=self._reps, stage=self._stage,
                feedback="Upper body not visible", feedback_level="warning",
                confidence=0.0,
            )

        elbow_angle = sum(available) / len(available)
        confidence  = len(available) / 2.0

        if elbow_angle < self._down_thresh:
            self._count_rep(Stage.DOWN)
        elif elbow_angle > self._up_thresh:
            self._count_rep(Stage.UP)

        feedback, level = self._build_feedback(elbow_angle)

        # Shoulder alignment check
        l_sh = get_shoulder_angle(landmarks, "left")
        r_sh = get_shoulder_angle(landmarks, "right")
        if l_sh and r_sh and abs(l_sh - r_sh) > 20:
            feedback = "Keep shoulders level!"
            level = "error"

        return ExerciseState(
            reps=self._reps,
            stage=self._stage,
            feedback=feedback,
            feedback_level=level,
            confidence=confidence,
            angles={"elbow": round(elbow_angle, 1)},
        )

    def _build_feedback(self, elbow_angle: float) -> tuple[str, str]:
        if self._stage == Stage.DOWN and elbow_angle > self._down_thresh + 20:
            return "Go lower – chest to floor!", "warning"
        if self._stage == Stage.UP:
            return "Arms straight! Lower down.", "info"
        if self._stage == Stage.DOWN:
            return "Good depth! Push up.", "info"
        return "Start push-ups – lower your chest.", "info"


# ─── Jumping Jack Tracker ─────────────────────────────────────────────────────

class JumpingJackTracker(_BaseTracker):
    """
    Rep counter for jumping jacks.

    Detection logic:
        • Tracks shoulder abduction angle for both arms.
        • Tracks ankle_width / shoulder_width ratio for leg spread.
        • DOWN (closed position): arms down + legs together.
        • UP   (open  position): arms raised + legs spread.
    """

    def __init__(self) -> None:
        super().__init__()
        cfg = _cfg.get("jumping_jack", {})
        self._arms_up_thresh   = cfg.get("arms_up_angle",   150)
        self._arms_down_thresh = cfg.get("arms_down_angle",  40)
        self._legs_out_ratio   = cfg.get("legs_out_ratio",  0.35)

    def update(self, landmarks: dict) -> ExerciseState:
        l_sh = get_shoulder_angle(landmarks, "left")
        r_sh = get_shoulder_angle(landmarks, "right")

        sw = get_shoulder_width(landmarks)
        aw = get_ankle_width(landmarks)

        available = [a for a in [l_sh, r_sh] if a is not None]
        if not available or sw is None:
            return ExerciseState(
                reps=self._reps, stage=self._stage,
                feedback="Full body not visible", feedback_level="warning",
                confidence=0.0,
            )

        arm_angle = sum(available) / len(available)
        legs_out  = (aw / sw) > self._legs_out_ratio if aw is not None else False
        confidence = len(available) / 2.0

        # Open position: arms up + legs spread
        if arm_angle > self._arms_up_thresh and legs_out:
            self._count_rep(Stage.UP)
        # Closed position: arms down + legs together
        elif arm_angle < self._arms_down_thresh and not legs_out:
            self._count_rep(Stage.DOWN)

        feedback, level = self._build_feedback(arm_angle, legs_out)

        return ExerciseState(
            reps=self._reps,
            stage=self._stage,
            feedback=feedback,
            feedback_level=level,
            confidence=confidence,
            angles={"arm_abduction": round(arm_angle, 1)},
        )

    def _build_feedback(self, arm_angle: float, legs_out: bool) -> tuple[str, str]:
        if self._stage == Stage.UP:
            return "Great! Now close arms and legs.", "info"
        if self._stage == Stage.DOWN:
            return "Open arms and legs wide!", "info"
        if arm_angle > 80:
            return "Spread your legs wider!" if not legs_out else "Raise arms higher!", "warning"
        return "Jump – spread arms and legs!", "info"


# ─── Factory ──────────────────────────────────────────────────────────────────

TRACKER_MAP: dict[str, type] = {
    "squat": SquatTracker,
    "pushup": PushupTracker,
    "jumping_jack": JumpingJackTracker,
    "jump_squat": JumpSquatTracker,
    "deep_squat": DeepSquatTracker,
    "lunge": LungeTracker,
    "plank": PlankTracker,
    "burpee": BurpeeTracker,
    "high_knees": HighKneesTracker,
    "lateral_shuffle": LateralShuffleTracker,
    "arm_circles": ArmCirclesTracker,
    "shoulder_rotation": ShoulderRotationTracker,
    "forward_bend": ForwardBendTracker,
    "overhead_throw": OverheadThrowTracker,
}


def get_tracker(exercise: str) -> _BaseTracker:
    """
    Instantiate a tracker by exercise name.

    Args:
        exercise: One of the supported exercise keys.

    Returns:
        Configured tracker instance.

    Raises:
        ValueError: If exercise is unknown.
    """
    cls = TRACKER_MAP.get(exercise.lower())
    if cls is None:
        raise ValueError(
            f"Unknown exercise '{exercise}'. "
            f"Choose from: {list(TRACKER_MAP.keys())}"
        )
    return cls()
