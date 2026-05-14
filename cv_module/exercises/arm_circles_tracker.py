"""
arm_circles_tracker.py – Motion pattern tracker for arm circles.

Detection logic:
    • Tracks the shoulder-to-wrist angle (hip → shoulder → wrist).
    • As the arm rotates in a circle, this angle goes through a full cycle:
      low → high → low = 1 rotation.
    • Checks that the arm stays relatively straight (elbow angle > threshold).
"""

from __future__ import annotations
from utils.helpers import load_config
from cv_module.angle_utils import get_shoulder_to_wrist_angle, get_elbow_angle

_cfg = load_config().get("exercises", {}).get("arm_circles", {})


class ArmCirclesTracker:
    def __init__(self):
        self._reps = 0
        self._stage = "DOWN"
        self._arm_straight_min = _cfg.get("arm_straight_min", 140)
        self._arm_up = _cfg.get("arm_up_angle", 120)
        self._arm_down = _cfg.get("arm_down_angle", 50)
        self._was_up = False
        self._was_down = False

    def reset(self):
        self._reps = 0
        self._stage = "DOWN"
        self._was_up = False
        self._was_down = False

    @property
    def reps(self):
        return self._reps

    @property
    def stage(self):
        return self._stage

    def update(self, landmarks: dict) -> dict:
        l_sw = get_shoulder_to_wrist_angle(landmarks, "left")
        r_sw = get_shoulder_to_wrist_angle(landmarks, "right")
        l_elbow = get_elbow_angle(landmarks, "left")
        r_elbow = get_elbow_angle(landmarks, "right")

        available = [a for a in [l_sw, r_sw] if a is not None]
        if not available:
            return self._state("Arms not visible", "warning", 0.0, {})

        arm_angle = sum(available) / len(available)
        angles = {"shoulder_wrist_angle": round(arm_angle, 1)}
        confidence = len(available) / 2.0

        # Check arm straightness
        elbow_angles = [a for a in [l_elbow, r_elbow] if a is not None]
        arms_straight = True
        if elbow_angles:
            avg_elbow = sum(elbow_angles) / len(elbow_angles)
            angles["elbow"] = round(avg_elbow, 1)
            if avg_elbow < self._arm_straight_min:
                arms_straight = False

        # Rotation detection: relaxed high/low thresholds to tolerate noisy camera input.
        if arm_angle > self._arm_up:
            self._was_up = True
            self._stage = "UP"
        elif arm_angle < self._arm_down:
            if self._was_up:
                self._was_down = True
            self._stage = "DOWN"

        # Full circle: was up, then was down, now up again
        if self._was_up and self._was_down and arm_angle > self._arm_up:
            self._reps += 1
            self._was_up = True
            self._was_down = False

        feedback, level = "Extend arms and start circling.", "info"
        if self._stage == "UP":
            feedback, level = "Good! Keep circling.", "info"
        elif self._stage == "DOWN":
            feedback, level = "Continue the circle — bring arms back up.", "info"

        if not arms_straight:
            feedback = "Keep your arms straight!"
            level = "warning"

        return self._state(feedback, level, confidence, angles)

    def _state(self, feedback, level, confidence, angles):
        return {
            "exercise": "arm_circles",
            "rep_count": self._reps,
            "stage": self._stage,
            "correct_form": level != "error",
            "feedback": feedback,
            "feedback_level": level,
            "angles": angles,
            "confidence": confidence,
        }
