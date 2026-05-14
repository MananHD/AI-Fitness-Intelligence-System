"""
plank_tracker.py – Timer-based plank hold tracker.

Detection logic:
    • Checks body alignment: shoulder → hip → ankle should be ~180°.
    • Detects hip sag (angle too small) and hip pike (angle too large).
    • Tracks hold duration in seconds.
    • No rep counting — uses elapsed time.
"""

from __future__ import annotations
import time
from utils.helpers import load_config
from cv_module.angle_utils import get_body_alignment_angle, get_torso_angle

_cfg = load_config().get("exercises", {}).get("plank", {})


class PlankTracker:
    def __init__(self):
        self._stage = "UNKNOWN"
        self._hold_start = None
        self._total_hold = 0.0
        self._min_angle = _cfg.get("min_body_angle", 155)
        self._max_sag = _cfg.get("max_hip_sag", 25)
        self._max_pike = _cfg.get("max_hip_pike", 25)

    def reset(self):
        self._stage = "UNKNOWN"
        self._hold_start = None
        self._total_hold = 0.0

    @property
    def reps(self):
        return 0  # Plank is timer-based

    @property
    def stage(self):
        return self._stage

    @property
    def hold_duration(self):
        extra = 0
        if self._hold_start is not None:
            extra = time.time() - self._hold_start
        return round(self._total_hold + extra, 1)

    def update(self, landmarks: dict) -> dict:
        body_angle = get_body_alignment_angle(landmarks)

        if body_angle is None:
            if self._hold_start is not None:
                self._total_hold += time.time() - self._hold_start
                self._hold_start = None
            self._stage = "UNKNOWN"
            return self._state("Position your full body in frame", "warning", 0.0, {})

        angles = {"body_alignment": round(body_angle, 1)}
        is_holding = body_angle >= self._min_angle

        if is_holding:
            if self._hold_start is None:
                self._hold_start = time.time()
            self._stage = "HOLD"
        else:
            if self._hold_start is not None:
                self._total_hold += time.time() - self._hold_start
                self._hold_start = None
            self._stage = "DOWN"

        # Form feedback
        feedback, level = "Get into plank position.", "info"
        if self._stage == "HOLD":
            deviation = 180 - body_angle
            if deviation > self._max_sag:
                feedback, level = "Hips are sagging! Tighten your core.", "error"
            elif deviation > self._max_pike:
                feedback, level = "Hips too high! Lower them.", "warning"
            else:
                dur = self.hold_duration
                feedback = f"Great form! Hold it — {dur:.0f}s"
                level = "info"
        elif self._stage == "DOWN":
            feedback, level = "Straighten your body — align shoulders, hips, ankles.", "warning"

        return self._state(feedback, level, 1.0, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "plank",
            "rep_count": 0,
            "stage": self._stage,
            "hold_duration": self.hold_duration,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
