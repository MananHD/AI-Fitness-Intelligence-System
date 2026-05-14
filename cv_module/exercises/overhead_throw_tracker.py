"""
overhead_throw_tracker.py – Rep counter for overhead throw motion.

Detection logic:
    • Tracks shoulder-to-wrist angle for the throwing arm.
    • WIND phase: arm pulled back (low angle).
    • THROW phase: arm extended forward/overhead (high angle).
    • WIND → THROW = 1 rep.
    • Checks elbow extension during throw phase.
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_shoulder_to_wrist_angle, get_elbow_angle

_cfg = load_config().get("exercises", {}).get("overhead_throw", {})


class OverheadThrowTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "UNKNOWN"
        self._wind_angle = _cfg.get("wind_angle", 60)
        self._release_angle = _cfg.get("release_angle", 160)

    def reset(self):
        self._reps = 0
        self._stage = "UNKNOWN"

    @property
    def reps(self):
        return self._reps

    @property
    def stage(self):
        return self._stage

    def update(self, landmarks: dict) -> dict:
        # Use the arm with more movement (check both)
        l_sw = get_shoulder_to_wrist_angle(landmarks, "left")
        r_sw = get_shoulder_to_wrist_angle(landmarks, "right")
        l_elbow = get_elbow_angle(landmarks, "left")
        r_elbow = get_elbow_angle(landmarks, "right")

        available = [a for a in [l_sw, r_sw] if a is not None]
        if not available:
            return self._state("Arms not visible", "warning", 0.0, {})

        # Use the arm with the more extreme angle (likely the throwing arm)
        arm_angle = max(available) if self._stage == "THROW" else min(available)
        angles = {"shoulder_wrist": round(arm_angle, 1)}
        confidence = len(available) / 2.0

        elbow_angles = [a for a in [l_elbow, r_elbow] if a is not None]
        if elbow_angles:
            angles["elbow"] = round(max(elbow_angles), 1)

        if arm_angle < self._wind_angle:
            self._stage = "WIND"
        elif arm_angle > self._release_angle and self._stage == "WIND":
            self._stage = "THROW"
            self._reps += 1

        feedback, level = "Pull arm back behind your head.", "info"
        if self._stage == "WIND":
            feedback, level = "Good wind-up! Now throw forward!", "info"
        elif self._stage == "THROW":
            feedback, level = "Great throw! Wind up again.", "info"
            # Check elbow extension
            if elbow_angles and max(elbow_angles) < 140:
                feedback = "Extend your arm fully when throwing!"
                level = "warning"

        return self._state(feedback, level, confidence, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "overhead_throw",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
