"""
deep_squat_tracker.py – Rep counter for deep squats (ATG squats).

Detection logic:
    • Same as regular squat but with DEEPER threshold (knee angle < 70°).
    • DOWN when knee_angle < 70 (deeper than regular squat's 90).
    • UP when knee_angle > 160.
    • Warns on back lean, incomplete depth.
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_knee_angle, get_torso_angle

_cfg = load_config().get("exercises", {}).get("deep_squat", {})


class DeepSquatTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "DOWN"
        self._down_thresh = _cfg.get("down_angle", 70)
        self._up_thresh = _cfg.get("up_angle", 160)
        self._back_max = _cfg.get("back_angle_max", 50)

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

        available = [a for a in [l_knee, r_knee] if a is not None]
        if not available:
            return self._state("Lower body not visible", "warning", 0.0, {})

        knee_angle = sum(available) / len(available)
        angles = {"knee": round(knee_angle, 1)}
        confidence = len(available) / 2.0
        if torso is not None:
            angles["torso"] = torso

        if knee_angle < self._down_thresh:
            if self._stage != "DOWN":
                self._stage = "DOWN"
        elif knee_angle > self._up_thresh:
            if self._stage == "DOWN":
                self._reps += 1
            self._stage = "UP"

        feedback, level = "Start deep squat — go as low as you can!", "info"
        if self._stage == "DOWN":
            if knee_angle > self._down_thresh + 20:
                feedback, level = "Go deeper! Aim below parallel.", "warning"
            else:
                feedback, level = "Excellent depth! Push back up.", "info"
        elif self._stage == "UP":
            feedback, level = "Great deep squat! Go down again.", "info"

        if torso is not None and torso > self._back_max:
            feedback, level = "Keep your back straight!", "error"

        return self._state(feedback, level, confidence, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "deep_squat",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
