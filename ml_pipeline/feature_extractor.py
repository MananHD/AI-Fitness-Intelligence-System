"""
feature_extractor.py – MediaPipe-based biometric ratio extractor.
Compatible with mediapipe >= 0.10 (Tasks API).
"""

import math

LM = {
    "nose":           0,
    "left_shoulder":  11, "right_shoulder": 12,
    "left_elbow":     13, "right_elbow":    14,
    "left_wrist":     15, "right_wrist":    16,
    "left_hip":       23, "right_hip":      24,
    "left_knee":      25, "right_knee":     26,
    "left_ankle":     27, "right_ankle":    28,
}

FEATURE_NAMES = [
    "shoulder_width_ratio",
    "hip_width_ratio",
    "shoulder_hip_ratio",
    "torso_ratio",
    "upper_leg_ratio",
    "lower_leg_ratio",
    "crural_index",
    "upper_arm_ratio",
    "forearm_ratio",
    "ape_index",
    "cog_ratio",
    "upper_body_ratio",
]

VISIBILITY_THRESHOLD = 0.50
MIN_VISIBLE_KEY_LANDMARKS = 12


def _dist(p1, p2):
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def _mid(p1, p2):
    return ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0)


def extract_features_from_landmarks(landmarks, img_h: int, img_w: int):
    """
    Accepts any landmark list where each object has .x .y (.visibility optional).
    Returns dict of 12 biometric ratios, or None if thresholds not met.
    """
    pts = {}
    visible_count = 0
    for name, idx in LM.items():
        lm = landmarks[idx]
        vis = getattr(lm, "visibility", 1.0)
        if vis >= VISIBILITY_THRESHOLD:
            visible_count += 1
        pts[name] = (lm.x * img_w, lm.y * img_h)

    if visible_count < MIN_VISIBLE_KEY_LANDMARKS:
        return None

    ankle_mid = _mid(pts["left_ankle"], pts["right_ankle"])
    height = _dist(pts["nose"], ankle_mid)
    if height < 1e-6:
        return None

    shoulder_w   = _dist(pts["left_shoulder"],  pts["right_shoulder"])
    hip_w        = _dist(pts["left_hip"],        pts["right_hip"])
    shoulder_mid = _mid(pts["left_shoulder"],    pts["right_shoulder"])
    hip_mid      = _mid(pts["left_hip"],         pts["right_hip"])
    torso        = _dist(shoulder_mid, hip_mid)
    head_seg     = _dist(pts["nose"], shoulder_mid)

    upper_leg = (_dist(pts["left_hip"],  pts["left_knee"])  +
                 _dist(pts["right_hip"], pts["right_knee"])) / 2.0
    lower_leg = (_dist(pts["left_knee"],  pts["left_ankle"])  +
                 _dist(pts["right_knee"], pts["right_ankle"])) / 2.0
    upper_arm = (_dist(pts["left_shoulder"],  pts["left_elbow"])  +
                 _dist(pts["right_shoulder"], pts["right_elbow"])) / 2.0
    forearm   = (_dist(pts["left_elbow"],  pts["left_wrist"])  +
                 _dist(pts["right_elbow"], pts["right_wrist"])) / 2.0

    arm_length = upper_arm + forearm
    cog        = _dist(pts["nose"], hip_mid)

    return {
        "shoulder_width_ratio": shoulder_w / height,
        "hip_width_ratio":      hip_w      / height,
        "shoulder_hip_ratio":   shoulder_w / hip_w      if hip_w   > 0 else 0.0,
        "torso_ratio":          torso      / height,
        "upper_leg_ratio":      upper_leg  / height,
        "lower_leg_ratio":      lower_leg  / height,
        "crural_index":         lower_leg  / upper_leg  if upper_leg > 0 else 0.0,
        "upper_arm_ratio":      upper_arm  / height,
        "forearm_ratio":        forearm    / height,
        "ape_index":            (2 * arm_length) / height,
        "cog_ratio":            cog        / height,
        "upper_body_ratio":     (head_seg + torso) / height,
    }
