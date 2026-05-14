"""
burpee_tracker.py – Multi-phase burpee rep counter.

State machine: STAND → SQUAT → PLANK → SQUAT → STAND = 1 rep
Uses knee angle for squat phase, body alignment for plank phase.
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_knee_angle, get_body_alignment_angle

_cfg = load_config().get("exercises", {}).get("burpee", {})


class BurpeeTracker:
    STAND = "STAND"
    SQUAT = "SQUAT"
    PLANK = "PLANK"

    def __init__(self):
        self._reps = 0
        self._stage = self.STAND
        self._phase = 0  # 0=waiting, 1=went_to_squat, 2=went_to_plank, 3=back_to_squat
        self._squat_angle = _cfg.get("squat_angle", 110)
        self._plank_angle = _cfg.get("plank_angle", 155)
        self._stand_angle = _cfg.get("stand_angle", 160)

    def reset(self):
        self._reps = 0
        self._stage = self.STAND
        self._phase = 0

    @property
    def reps(self):
        return self._reps

    @property
    def stage(self):
        return self._stage

    def update(self, landmarks: dict) -> dict:
        l_knee = get_knee_angle(landmarks, "left")
        r_knee = get_knee_angle(landmarks, "right")
        body_align = get_body_alignment_angle(landmarks)

        available_knees = [a for a in [l_knee, r_knee] if a is not None]
        if not available_knees:
            return self._state("Full body not visible", "warning", 0.0, {})

        knee_angle = sum(available_knees) / len(available_knees)
        angles = {"knee": round(knee_angle, 1)}
        if body_align is not None:
            angles["body_alignment"] = round(body_align, 1)

        is_standing = knee_angle > self._stand_angle
        is_squatting = knee_angle < self._squat_angle
        is_plank = body_align is not None and body_align > self._plank_angle and knee_angle > self._stand_angle - 20

        # Phase state machine
        if self._phase == 0 and is_standing:
            self._stage = self.STAND
        if self._phase == 0 and is_squatting:
            self._phase = 1
            self._stage = self.SQUAT
        elif self._phase == 1 and is_plank:
            self._phase = 2
            self._stage = self.PLANK
        elif self._phase == 2 and is_squatting:
            self._phase = 3
            self._stage = self.SQUAT
        elif self._phase == 3 and is_standing:
            self._reps += 1
            self._phase = 0
            self._stage = self.STAND

        feedback, level = self._build_feedback()
        return self._state(feedback, level, len(available_knees) / 2.0, angles)

    def _build_feedback(self):
        if self._phase == 0:
            return "Ready! Drop into a squat.", "info"
        elif self._phase == 1:
            return "Good squat! Kick legs back to plank.", "info"
        elif self._phase == 2:
            return "Plank position! Jump feet forward.", "info"
        elif self._phase == 3:
            return "Almost there! Stand up and jump!", "info"
        return "Start your burpee.", "info"

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "burpee",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
