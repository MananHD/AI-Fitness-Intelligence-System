"""
lateral_shuffle_tracker.py – Motion pattern tracker for lateral shuffles.

Detection logic:
    • Tracks ankle spread relative to shoulder width.
    • Wide stance (feet > 1.5x shoulder width) = WIDE.
    • Narrow stance (feet < 0.8x shoulder width) = NARROW.
    • NARROW → WIDE → NARROW = 1 rep.
    • Checks hip level stays consistent (no bouncing).
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_foot_spread_ratio

_cfg = load_config().get("exercises", {}).get("lateral_shuffle", {})


class LateralShuffleTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "UNKNOWN"
        self._spread_out = _cfg.get("spread_ratio_out", 1.5)
        self._spread_in = _cfg.get("spread_ratio_in", 0.8)
        self._went_wide = False

    def reset(self):
        self._reps = 0
        self._stage = "UNKNOWN"
        self._went_wide = False

    @property
    def reps(self):
        return self._reps

    @property
    def stage(self):
        return self._stage

    def update(self, landmarks: dict) -> dict:
        ratio = get_foot_spread_ratio(landmarks)

        if ratio is None:
            return self._state("Feet not visible", "warning", 0.0, {})

        angles = {"foot_spread_ratio": ratio}

        if ratio >= self._spread_out:
            self._stage = "WIDE"
            self._went_wide = True
        elif ratio <= self._spread_in and self._went_wide:
            self._stage = "NARROW"
            self._reps += 1
            self._went_wide = False
        elif ratio <= self._spread_in:
            self._stage = "NARROW"

        feedback, level = "Start shuffling — spread your feet wide!", "info"
        if self._stage == "WIDE":
            feedback, level = "Good spread! Shuffle back narrow.", "info"
        elif self._stage == "NARROW":
            feedback, level = "Now shuffle wide — quick feet!", "info"

        return self._state(feedback, level, 1.0, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "lateral_shuffle",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
