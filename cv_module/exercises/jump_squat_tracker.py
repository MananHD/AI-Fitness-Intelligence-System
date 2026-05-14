"""
jump_squat_tracker.py – Rep counter for jump squats.

Detection logic:
    • DOWN when knee_angle < down_threshold (squatting).
    • Detects jump by tracking ankle Y position — when ankle rises
      significantly from the baseline, the person has jumped.
    • JUMP → LAND → ready for next rep.
    • State: UP → DOWN → JUMP → UP = 1 rep.
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_knee_angle, get_ankle_y, get_torso_angle

_cfg = load_config().get("exercises", {}).get("jump_squat", {})


class JumpSquatTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "DOWN"
        self._down_thresh = _cfg.get("down_angle", 100)
        self._up_thresh = _cfg.get("up_angle", 160)
        self._jump_thresh = _cfg.get("jump_pixel_thresh", 15)
        self._baseline_ankle_y = None
        self._went_down = False

    def reset(self):
        self._reps = 0
        self._stage = "DOWN"
        self._baseline_ankle_y = None
        self._went_down = True

    @property
    def reps(self):
        return self._reps

    @property
    def stage(self):
        return self._stage

    def update(self, landmarks: dict) -> dict:
        l_knee = get_knee_angle(landmarks, "left")
        r_knee = get_knee_angle(landmarks, "right")
        l_ankle = get_ankle_y(landmarks, "left")
        r_ankle = get_ankle_y(landmarks, "right")
        torso = get_torso_angle(landmarks)

        available = [a for a in [l_knee, r_knee] if a is not None]
        if not available:
            return self._state("Lower body not visible", "warning", 0.0, {})

        knee_angle = sum(available) / len(available)
        angles = {"knee": round(knee_angle, 1)}
        if torso is not None:
            angles["torso"] = torso

        # Track ankle baseline for jump detection
        ankle_vals = [a for a in [l_ankle, r_ankle] if a is not None]
        current_ankle_y = sum(ankle_vals) / len(ankle_vals) if ankle_vals else None

        if current_ankle_y is not None:
            if self._baseline_ankle_y is None:
                self._baseline_ankle_y = current_ankle_y
            # Smooth baseline (only update when standing)
            if knee_angle > self._up_thresh:
                self._baseline_ankle_y = 0.95 * self._baseline_ankle_y + 0.05 * current_ankle_y

        # State machine
        if knee_angle < self._down_thresh:
            self._stage = "DOWN"
            self._went_down = True
        elif self._went_down and knee_angle > self._up_thresh:
            # Count the rep as soon as the squat closes back to standing.
            # Jump height is treated as form feedback only, not as a hard gate.
            self._stage = "UP"
            self._reps += 1
            self._went_down = False

        feedback, level = "Start your jump squat — squat deep then explode up!", "info"
        if self._stage == "DOWN":
            feedback, level = "Good squat! Now explode upward!", "info"
        elif self._stage == "UP":
            feedback, level = "Great jump! Squat back down.", "info"

        if torso is not None and torso > 50:
            feedback, level = "Keep your back straight!", "error"

        return self._state(feedback, level, len(available) / 2.0, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "jump_squat",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
