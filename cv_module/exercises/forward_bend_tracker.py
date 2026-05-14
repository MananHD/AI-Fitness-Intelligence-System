"""
forward_bend_tracker.py – Rep counter for standing forward bends.

Detection logic:
    • Uses hip angle (shoulder → hip → knee).
    • DOWN when hip angle < down_threshold (body folded forward).
    • UP when hip angle > up_threshold (standing straight).
    • DOWN → UP = 1 rep.
    • Checks that legs stay relatively straight.
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_hip_angle, get_knee_angle

_cfg = load_config().get("exercises", {}).get("forward_bend", {})


class ForwardBendTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "UNKNOWN"
        self._down_thresh = _cfg.get("hip_angle_down", 90)
        self._up_thresh = _cfg.get("hip_angle_up", 160)

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
        l_hip = get_hip_angle(landmarks, "left")
        r_hip = get_hip_angle(landmarks, "right")
        l_knee = get_knee_angle(landmarks, "left")
        r_knee = get_knee_angle(landmarks, "right")

        available = [a for a in [l_hip, r_hip] if a is not None]
        if not available:
            return self._state("Body not visible", "warning", 0.0, {})

        hip_angle = sum(available) / len(available)
        angles = {"hip": round(hip_angle, 1)}
        confidence = len(available) / 2.0

        # Check leg straightness
        knee_angles = [a for a in [l_knee, r_knee] if a is not None]
        if knee_angles:
            avg_knee = sum(knee_angles) / len(knee_angles)
            angles["knee"] = round(avg_knee, 1)

        if hip_angle < self._down_thresh:
            self._stage = "DOWN"
        elif hip_angle > self._up_thresh and self._stage == "DOWN":
            self._stage = "UP"
            self._reps += 1

        feedback, level = "Stand straight, then bend forward at the hips.", "info"
        if self._stage == "DOWN":
            feedback, level = "Good depth! Come back up slowly.", "info"
            # Check if knees are bending too much
            if knee_angles and avg_knee < 150:
                feedback = "Keep your legs straight — don't bend knees!"
                level = "warning"
        elif self._stage == "UP":
            feedback, level = "Great! Bend forward again.", "info"

        return self._state(feedback, level, confidence, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "forward_bend",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
