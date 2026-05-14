"""
shoulder_rotation_tracker.py – Motion pattern tracker for shoulder rotations.

Detection logic:
    • Tracks shoulder abduction angle (elbow → shoulder → hip).
    • UP when arms raised above threshold, DOWN when lowered.
    • DOWN → UP → DOWN = 1 rep.
    • Similar to arm circles but focuses on controlled up/down motion.
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_shoulder_angle

_cfg = load_config().get("exercises", {}).get("shoulder_rotation", {})


class ShoulderRotationTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "DOWN"
        self._up_thresh = _cfg.get("up_angle", 140)
        self._down_thresh = _cfg.get("down_angle", 40)

    def reset(self):
        self._reps = 0
        self._stage = "DOWN"

    @property
    def reps(self):
        return self._reps

    @property
    def stage(self):
        return self._stage

    def update(self, landmarks: dict) -> dict:
        l_sh = get_shoulder_angle(landmarks, "left")
        r_sh = get_shoulder_angle(landmarks, "right")

        available = [a for a in [l_sh, r_sh] if a is not None]
        if not available:
            return self._state("Upper body not visible", "warning", 0.0, {})

        angle = sum(available) / len(available)
        angles = {"shoulder_abduction": round(angle, 1)}
        confidence = len(available) / 2.0

        if angle > self._up_thresh:
            if self._stage == "DOWN":
                self._reps += 1
            self._stage = "UP"
        elif angle < self._down_thresh:
            self._stage = "DOWN"

        feedback, level = "Start rotating — raise arms overhead.", "info"
        if self._stage == "UP":
            feedback, level = "Good! Now lower back down.", "info"
        elif self._stage == "DOWN":
            feedback, level = "Now raise arms up and rotate.", "info"

        return self._state(feedback, level, confidence, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "shoulder_rotation",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
