"""
high_knees_tracker.py – Rep counter for high knees.

Detection logic:
    • Tracks knee lift height relative to hip for both legs.
    • Counts one rep per knee lift above the threshold.
    • Alternates left/right for proper form.
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_knee_height_ratio

_cfg = load_config().get("exercises", {}).get("high_knees", {})


class HighKneesTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "UNKNOWN"
        self._lift_ratio = _cfg.get("knee_lift_ratio", 0.85)
        self._last_lifted = None  # "left" or "right"
        self._left_was_up = False
        self._right_was_up = False

    def reset(self):
        self._reps = 0
        self._stage = "UNKNOWN"
        self._last_lifted = None
        self._left_was_up = False
        self._right_was_up = False

    @property
    def reps(self):
        return self._reps

    @property
    def stage(self):
        return self._stage

    def update(self, landmarks: dict) -> dict:
        l_ratio = get_knee_height_ratio(landmarks, "left")
        r_ratio = get_knee_height_ratio(landmarks, "right")

        angles = {}
        if l_ratio is not None:
            angles["left_knee_lift"] = l_ratio
        if r_ratio is not None:
            angles["right_knee_lift"] = r_ratio

        if l_ratio is None and r_ratio is None:
            return self._state("Full body not visible", "warning", 0.0, angles)

        confidence = sum(1 for r in [l_ratio, r_ratio] if r is not None) / 2.0

        # Check left knee
        if l_ratio is not None and l_ratio >= self._lift_ratio:
            if not self._left_was_up:
                self._left_was_up = True
                self._reps += 1
                self._stage = "LEFT_UP"
                self._last_lifted = "left"
        else:
            self._left_was_up = False

        # Check right knee
        if r_ratio is not None and r_ratio >= self._lift_ratio:
            if not self._right_was_up:
                self._right_was_up = True
                self._reps += 1
                self._stage = "RIGHT_UP"
                self._last_lifted = "right"
        else:
            self._right_was_up = False

        if not self._left_was_up and not self._right_was_up:
            self._stage = "DOWN"

        feedback, level = "Lift your knees high!", "info"
        if self._stage in ("LEFT_UP", "RIGHT_UP"):
            feedback = f"Good lift! Now the other knee."
            level = "info"
        elif self._stage == "DOWN":
            feedback = "Drive those knees up — hip level!"
            level = "info"

        # Check if knees aren't going high enough
        max_ratio = max(
            l_ratio if l_ratio is not None else 0,
            r_ratio if r_ratio is not None else 0,
        )
        if 0 < max_ratio < self._lift_ratio * 0.6:
            feedback = "Higher! Bring your knees up to hip level."
            level = "warning"

        return self._state(feedback, level, confidence, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "high_knees",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
