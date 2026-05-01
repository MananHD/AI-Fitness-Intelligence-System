"""
angle_utils.py – Geometric helpers for joint angle computation.

All angles are returned in degrees (0–180).
Named extractors pull specific joints from the landmark dict produced
by PoseDetector, which maps landmark name → [x_px, y_px, z, visibility].
"""

from __future__ import annotations

import math
from typing import Optional, Sequence

import numpy as np


# ─── Core Angle Calculator ────────────────────────────────────────────────────

def calculate_angle(
    A: Sequence[float],
    B: Sequence[float],
    C: Sequence[float],
) -> float:
    """
    Compute the interior angle (degrees) at joint B formed by vectors BA and BC.

    Uses only (x, y) components so it works for both 2-D and 3-D landmarks.

    Args:
        A: Coordinates of the first point  [x, y, …].
        B: Coordinates of the vertex joint [x, y, …].
        C: Coordinates of the third point  [x, y, …].

    Returns:
        Angle in degrees, clamped to [0, 180].
    """
    a = np.array(A[:2], dtype=float)
    b = np.array(B[:2], dtype=float)
    c = np.array(C[:2], dtype=float)

    ba = a - b
    bc = c - b

    cos_angle = np.dot(ba, bc) / (
        np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8
    )
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    return round(math.degrees(math.acos(cos_angle)), 2)


# ─── Named Joint Extractors ───────────────────────────────────────────────────

def _get(lm: dict, *keys: str) -> Optional[list[list[float]]]:
    """Return landmark coords for each key, or None if any is missing."""
    pts = [lm.get(k) for k in keys]
    if any(p is None for p in pts):
        return None
    return pts  # type: ignore[return-value]


def get_knee_angle(landmarks: dict, side: str = "left") -> Optional[float]:
    """
    Knee flexion angle: hip → knee → ankle.

    Args:
        landmarks: Dict from PoseDetector.
        side:      "left" or "right".

    Returns:
        Angle in degrees or None if keypoints are unavailable.
    """
    prefix = side.upper()
    pts = _get(landmarks, f"{prefix}_HIP", f"{prefix}_KNEE", f"{prefix}_ANKLE")
    if pts is None:
        return None
    return calculate_angle(*pts)


def get_elbow_angle(landmarks: dict, side: str = "left") -> Optional[float]:
    """Elbow flexion angle: shoulder → elbow → wrist."""
    prefix = side.upper()
    pts = _get(landmarks, f"{prefix}_SHOULDER", f"{prefix}_ELBOW", f"{prefix}_WRIST")
    if pts is None:
        return None
    return calculate_angle(*pts)


def get_shoulder_angle(landmarks: dict, side: str = "left") -> Optional[float]:
    """
    Shoulder abduction angle: elbow → shoulder → hip.

    Used to detect how high the arm is raised (e.g. jumping jacks).
    """
    prefix = side.upper()
    pts = _get(landmarks, f"{prefix}_ELBOW", f"{prefix}_SHOULDER", f"{prefix}_HIP")
    if pts is None:
        return None
    return calculate_angle(*pts)


def get_hip_angle(landmarks: dict, side: str = "left") -> Optional[float]:
    """Hip flexion angle: shoulder → hip → knee."""
    prefix = side.upper()
    pts = _get(landmarks, f"{prefix}_SHOULDER", f"{prefix}_HIP", f"{prefix}_KNEE")
    if pts is None:
        return None
    return calculate_angle(*pts)


def get_torso_angle(landmarks: dict) -> Optional[float]:
    """
    Estimate torso lean relative to vertical.

    Uses midpoint of shoulders and midpoint of hips to approximate the spine.
    Returns 0 when perfectly upright, increases as the torso leans.
    """
    required = ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]
    if any(k not in landmarks for k in required):
        return None

    ls, rs = landmarks["LEFT_SHOULDER"], landmarks["RIGHT_SHOULDER"]
    lh, rh = landmarks["LEFT_HIP"], landmarks["RIGHT_HIP"]

    mid_shoulder = [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2]
    mid_hip = [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2]

    dx = mid_shoulder[0] - mid_hip[0]
    dy = max(mid_hip[1] - mid_shoulder[1], 1e-8)   # positive in image coords
    return round(math.degrees(math.atan2(abs(dx), dy)), 2)


def get_shoulder_width(landmarks: dict) -> Optional[float]:
    """Normalised-coord horizontal distance between left and right shoulders."""
    pts = _get(landmarks, "LEFT_SHOULDER", "RIGHT_SHOULDER")
    if pts is None:
        return None
    return abs(pts[1][0] - pts[0][0])


def get_hip_width(landmarks: dict) -> Optional[float]:
    """Normalised-coord horizontal distance between left and right hips."""
    pts = _get(landmarks, "LEFT_HIP", "RIGHT_HIP")
    if pts is None:
        return None
    return abs(pts[1][0] - pts[0][0])


def get_ankle_width(landmarks: dict) -> Optional[float]:
    """Normalised-coord horizontal distance between left and right ankles."""
    pts = _get(landmarks, "LEFT_ANKLE", "RIGHT_ANKLE")
    if pts is None:
        return None
    return abs(pts[1][0] - pts[0][0])
