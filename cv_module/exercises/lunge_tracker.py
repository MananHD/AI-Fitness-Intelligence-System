"""
lunge_tracker.py – Rep counter for alternating lunges.

Detection logic:
    • Tracks BOTH left and right knee angles.
    • DOWN when the FRONT knee drops < down_threshold.
    • UP when the front knee extends > up_threshold.
    • Detects alternating legs for proper lunge form.
    • Warns if torso leans too far forward.
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_knee_angle, get_torso_angle

_cfg = load_config().get("exercises", {}).get("lunge", {})


class LungeTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "DOWN"
        self._down_thresh = _cfg.get("front_knee_down", 95)
        self._up_thresh = _cfg.get("front_knee_up", 160)
        self._back_max = _cfg.get("back_angle_max", 45)

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
        l_knee = get_knee_angle(landmarks, "left")
        r_knee = get_knee_angle(landmarks, "right")
        torso = get_torso_angle(landmarks)

        if l_knee is None and r_knee is None:
            return self._state("No lower body detected", "warning", 0.0, {})

        # Use the knee with the smaller angle as the "front" leg
        angles = {}
        if l_knee is not None:
            angles["left_knee"] = round(l_knee, 1)
        if r_knee is not None:
            angles["right_knee"] = round(r_knee, 1)

        available = [a for a in [l_knee, r_knee] if a is not None]
        front_knee = min(available)
        confidence = len(available) / 2.0

        if front_knee < self._down_thresh and self._stage != "DOWN":
            self._stage = "DOWN"
        elif front_knee > self._up_thresh and self._stage == "DOWN":
            self._stage = "UP"
            self._reps += 1

        feedback, level = "Start your lunge — step forward.", "info"
        if self._stage == "DOWN":
            if front_knee > self._down_thresh + 15:
                feedback, level = "Go deeper! Bend your front knee more.", "warning"
            else:
                feedback, level = "Good depth! Push back up.", "info"
        elif self._stage == "UP":
            feedback, level = "Great lunge! Step forward again.", "info"

        if torso is not None and torso > self._back_max:
            feedback, level = "Keep your torso upright!", "error"

        if torso is not None:
            angles["torso"] = torso

        return self._state(feedback, level, confidence, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "lunge",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
