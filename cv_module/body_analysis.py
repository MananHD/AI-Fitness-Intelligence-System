"""
body_analysis.py – Body composition analysis from pose landmarks + metadata.

Responsibilities:
  - BMI computation & WHO classification.
  - CV-based shoulder-to-hip ratio estimation.
  - Combined body type classification with confidence scoring.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Optional

from utils.helpers import load_config
from cv_module.angle_utils import get_shoulder_width, get_hip_width

logger = logging.getLogger(__name__)
_cfg = load_config()


# ─── Result Data Classes ──────────────────────────────────────────────────────

@dataclass
class BMIResult:
    weight_kg: float
    height_cm: float
    bmi: float
    category: str       # Underweight | Normal | Overweight | Obese

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class BodyAnalysisResult:
    bmi_result: BMIResult
    shoulder_hip_ratio: Optional[float]
    body_type: str          # Lean/Athletic | Average/Balanced | Wide Hip | Unknown
    confidence: float       # 0.0 – 1.0
    recommendations_hint: str

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


# ─── BMI ──────────────────────────────────────────────────────────────────────

def compute_bmi(weight_kg: float, height_cm: float) -> float:
    """
    Compute Body Mass Index (WHO formula).

    Args:
        weight_kg: Body weight in kg (must be > 0).
        height_cm: Height in cm (must be > 0).

    Returns:
        BMI rounded to 2 decimal places.

    Raises:
        ValueError: For non-positive inputs.
    """
    if weight_kg <= 0 or height_cm <= 0:
        raise ValueError("weight_kg and height_cm must both be positive.")
    h_m = height_cm / 100.0
    return round(weight_kg / (h_m ** 2), 2)


def classify_bmi(bmi: float) -> str:
    """
    Classify a BMI value into WHO categories.

    Returns:
        "Underweight" | "Normal" | "Overweight" | "Obese"
    """
    t = _cfg.get("bmi", {})
    if bmi < t.get("underweight", 18.5):
        return "Underweight"
    if bmi <= t.get("normal", 24.9):
        return "Normal"
    if bmi <= t.get("overweight", 29.9):
        return "Overweight"
    return "Obese"


# ─── CV Proportion Analysis ───────────────────────────────────────────────────

def analyze_body_proportions(landmarks: dict) -> dict:
    """
    Estimate body shape from MediaPipe pose landmarks.

    Computes the shoulder-to-hip width ratio (in normalised pixel space)
    and maps it to a qualitative body-type label.

    Args:
        landmarks: Dict produced by PoseDetector.detect().

    Returns:
        {
            "shoulder_width":    float | None,
            "hip_width":         float | None,
            "shoulder_hip_ratio": float | None,
            "body_type":         str,
        }
    """
    props = _cfg.get("body_proportions", {})
    lean_t = props.get("shoulder_hip_lean", 1.30)
    balanced_t = props.get("shoulder_hip_balanced", 1.10)

    sw = get_shoulder_width(landmarks)
    hw = get_hip_width(landmarks)

    if sw is None or hw is None or hw < 1e-6:
        return {
            "shoulder_width": None,
            "hip_width": None,
            "shoulder_hip_ratio": None,
            "body_type": "Unknown",
        }

    ratio = round(sw / hw, 3)
    if ratio >= lean_t:
        body_type = "Lean/Athletic"
    elif ratio >= balanced_t:
        body_type = "Average/Balanced"
    else:
        body_type = "Wide Hip"

    return {
        "shoulder_width": round(sw, 4),
        "hip_width": round(hw, 4),
        "shoulder_hip_ratio": ratio,
        "body_type": body_type,
    }


# ─── Combined Analysis ────────────────────────────────────────────────────────

def full_body_analysis(
    landmarks: Optional[dict],
    weight_kg: float,
    height_cm: float,
) -> BodyAnalysisResult:
    """
    Combine BMI + CV proportion analysis into a holistic assessment.

    Args:
        landmarks: Landmark dict from PoseDetector or None.
        weight_kg: User-provided weight in kg.
        height_cm: User-provided height in cm.

    Returns:
        BodyAnalysisResult dataclass.
    """
    bmi_val = compute_bmi(weight_kg, height_cm)
    category = classify_bmi(bmi_val)
    bmi_result = BMIResult(
        weight_kg=weight_kg,
        height_cm=height_cm,
        bmi=bmi_val,
        category=category,
    )

    proportions = analyze_body_proportions(landmarks) if landmarks else {
        "shoulder_width": None,
        "hip_width": None,
        "shoulder_hip_ratio": None,
        "body_type": "Unknown",
    }

    # Confidence: high when both CV and metadata are available
    confidence = 0.90 if proportions["shoulder_hip_ratio"] is not None else 0.60

    # Build hint combining BMI category + body type
    body_type = proportions["body_type"]
    hint = _build_hint(category, body_type)

    return BodyAnalysisResult(
        bmi_result=bmi_result,
        shoulder_hip_ratio=proportions["shoulder_hip_ratio"],
        body_type=body_type,
        confidence=confidence,
        recommendations_hint=hint,
    )


# ─── Private ──────────────────────────────────────────────────────────────────

def _build_hint(bmi_category: str, body_type: str) -> str:
    hints = {
        ("Underweight", "Lean/Athletic"):    "Focus on strength training and caloric surplus.",
        ("Underweight", "Average/Balanced"): "Increase protein intake; add resistance training.",
        ("Underweight", "Wide Hip"):         "Targeted hip-strengthening and balanced diet recommended.",
        ("Normal",      "Lean/Athletic"):    "Excellent base. Maintain with sport-specific training.",
        ("Normal",      "Average/Balanced"): "Great condition. Add variety to your workouts.",
        ("Normal",      "Wide Hip"):         "Core stability work and cardio will help balance proportions.",
        ("Overweight",  "Lean/Athletic"):    "Cardio + moderate strength training. Watch caloric intake.",
        ("Overweight",  "Average/Balanced"): "Low-impact cardio (swimming, walking) plus diet adjustments.",
        ("Overweight",  "Wide Hip"):         "Start with walking and swimming; reduce refined carbs.",
        ("Obese",       "Lean/Athletic"):    "Medical consultation recommended before intense exercise.",
        ("Obese",       "Average/Balanced"): "Low-impact exercise with supervised diet plan.",
        ("Obese",       "Wide Hip"):         "Gentle water exercise; focus on sustainable dietary change.",
    }
    return hints.get((bmi_category, body_type),
                     "Consult a fitness professional for a personalised plan.")
