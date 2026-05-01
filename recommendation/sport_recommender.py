"""
sport_recommender.py – Rule-based sport recommendation engine.

Maps (BMI category, body type, age group, fitness level) → ranked list of
sport recommendations, each with a rationale and intensity label.

An optional scikit-learn ML classifier is included and can be trained on
synthetic data when scikit-learn is available.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class SportRecommendation:
    sport: str
    intensity: str      # Low | Moderate | High
    rationale: str
    weekly_sessions: int
    duration_min: int   # minutes per session

    def to_dict(self) -> dict:
        return asdict(self)


# ─── Rule Table ───────────────────────────────────────────────────────────────

# Structure:  key = (bmi_category, body_type_prefix)
# body_type_prefix covers: "Lean/Athletic", "Average/Balanced", "Wide Hip", "Unknown"
_RULES: dict[tuple[str, str], list[dict]] = {

    ("Underweight", "Lean/Athletic"): [
        {"sport": "Gymnastics",        "intensity": "High",     "rationale": "Builds strength and flexibility matching your lean frame.", "weekly_sessions": 4, "duration_min": 60},
        {"sport": "Rock Climbing",     "intensity": "High",     "rationale": "Excellent strength-to-weight activity.",                   "weekly_sessions": 3, "duration_min": 90},
        {"sport": "Yoga",              "intensity": "Low",      "rationale": "Improves muscle mass and joint stability.",                 "weekly_sessions": 5, "duration_min": 45},
    ],
    ("Underweight", "Average/Balanced"): [
        {"sport": "Athletics (Track)", "intensity": "Moderate", "rationale": "Builds endurance and lean muscle.",                        "weekly_sessions": 4, "duration_min": 45},
        {"sport": "Swimming",          "intensity": "Moderate", "rationale": "Full-body workout; low injury risk.",                      "weekly_sessions": 3, "duration_min": 60},
        {"sport": "Yoga",              "intensity": "Low",      "rationale": "Strengthens core and improves flexibility.",               "weekly_sessions": 4, "duration_min": 45},
    ],
    ("Underweight", "Wide Hip"): [
        {"sport": "Yoga",              "intensity": "Low",      "rationale": "Targeted hip flexibility and core strength.",              "weekly_sessions": 5, "duration_min": 45},
        {"sport": "Dance",             "intensity": "Moderate", "rationale": "Fun cardio that improves body coordination.",              "weekly_sessions": 3, "duration_min": 60},
        {"sport": "Cycling",           "intensity": "Moderate", "rationale": "Low-impact cardio that tones lower body.",                 "weekly_sessions": 4, "duration_min": 40},
    ],

    ("Normal", "Lean/Athletic"): [
        {"sport": "Football",          "intensity": "High",     "rationale": "Speed and agility suit your athletic build.",              "weekly_sessions": 4, "duration_min": 90},
        {"sport": "Basketball",        "intensity": "High",     "rationale": "Explosive movements match your lean physique.",            "weekly_sessions": 3, "duration_min": 90},
        {"sport": "Athletics (Track)", "intensity": "High",     "rationale": "Sprint and endurance events ideal for lean athletes.",     "weekly_sessions": 5, "duration_min": 60},
    ],
    ("Normal", "Average/Balanced"): [
        {"sport": "Tennis",            "intensity": "Moderate", "rationale": "Full-body sport with great cardiovascular benefit.",       "weekly_sessions": 3, "duration_min": 60},
        {"sport": "Swimming",          "intensity": "Moderate", "rationale": "Balanced full-body conditioning.",                        "weekly_sessions": 4, "duration_min": 45},
        {"sport": "Cycling",           "intensity": "Moderate", "rationale": "Improves cardiovascular fitness and leg strength.",       "weekly_sessions": 4, "duration_min": 50},
    ],
    ("Normal", "Wide Hip"): [
        {"sport": "Swimming",          "intensity": "Moderate", "rationale": "Excellent for toning hips and full-body fitness.",        "weekly_sessions": 4, "duration_min": 45},
        {"sport": "Cycling",           "intensity": "Moderate", "rationale": "Low-impact; strengthens legs and glutes.",                "weekly_sessions": 3, "duration_min": 50},
        {"sport": "Dance",             "intensity": "Moderate", "rationale": "Improves coordination and burns calories.",               "weekly_sessions": 3, "duration_min": 60},
    ],

    ("Overweight", "Lean/Athletic"): [
        {"sport": "Swimming",          "intensity": "Moderate", "rationale": "Reduces joint load while burning calories effectively.",   "weekly_sessions": 4, "duration_min": 45},
        {"sport": "Cycling",           "intensity": "Moderate", "rationale": "Low-impact cardio to manage weight.",                     "weekly_sessions": 4, "duration_min": 50},
        {"sport": "Walking",           "intensity": "Low",      "rationale": "Safe, sustainable daily activity.",                       "weekly_sessions": 7, "duration_min": 40},
    ],
    ("Overweight", "Average/Balanced"): [
        {"sport": "Walking",           "intensity": "Low",      "rationale": "Gentle introduction to regular movement.",                "weekly_sessions": 7, "duration_min": 40},
        {"sport": "Swimming",          "intensity": "Moderate", "rationale": "Burns calories with minimal joint stress.",               "weekly_sessions": 3, "duration_min": 45},
        {"sport": "Yoga",              "intensity": "Low",      "rationale": "Improves flexibility and stress management.",             "weekly_sessions": 4, "duration_min": 40},
    ],
    ("Overweight", "Wide Hip"): [
        {"sport": "Walking",           "intensity": "Low",      "rationale": "Most accessible starting point.",                        "weekly_sessions": 7, "duration_min": 30},
        {"sport": "Swimming",          "intensity": "Low",      "rationale": "Water buoyancy reduces pressure on joints.",              "weekly_sessions": 3, "duration_min": 40},
        {"sport": "Yoga",              "intensity": "Low",      "rationale": "Gentle movement for flexibility and calm.",               "weekly_sessions": 4, "duration_min": 30},
    ],

    ("Obese", "Lean/Athletic"): [
        {"sport": "Walking",           "intensity": "Low",      "rationale": "Start slow; build habit and aerobic base.",               "weekly_sessions": 7, "duration_min": 30},
        {"sport": "Swimming",          "intensity": "Low",      "rationale": "Safest high-calorie-burn activity for heavier frames.",   "weekly_sessions": 3, "duration_min": 30},
        {"sport": "Yoga",              "intensity": "Low",      "rationale": "Mobility and breathing foundation.",                     "weekly_sessions": 3, "duration_min": 30},
    ],
    ("Obese", "Average/Balanced"): [
        {"sport": "Walking",           "intensity": "Low",      "rationale": "Daily walking creates sustainable caloric deficit.",      "weekly_sessions": 7, "duration_min": 30},
        {"sport": "Swimming",          "intensity": "Low",      "rationale": "Zero joint-impact cardio.",                              "weekly_sessions": 3, "duration_min": 30},
        {"sport": "Chair Yoga",        "intensity": "Low",      "rationale": "Accessible flexibility and breath work.",                "weekly_sessions": 4, "duration_min": 20},
    ],
    ("Obese", "Wide Hip"): [
        {"sport": "Water Aerobics",    "intensity": "Low",      "rationale": "Excellent buoyancy support for higher body weight.",      "weekly_sessions": 3, "duration_min": 30},
        {"sport": "Walking",           "intensity": "Low",      "rationale": "Builds aerobic base with low injury risk.",               "weekly_sessions": 5, "duration_min": 25},
        {"sport": "Chair Yoga",        "intensity": "Low",      "rationale": "Seated postures for safe range-of-motion work.",         "weekly_sessions": 4, "duration_min": 20},
    ],
}

# Fallback when Unknown body type
_FALLBACK: dict[str, list[dict]] = {
    "Underweight": [
        {"sport": "Yoga",              "intensity": "Low",      "rationale": "Safe and beneficial regardless of body type.",           "weekly_sessions": 4, "duration_min": 40},
        {"sport": "Swimming",          "intensity": "Moderate", "rationale": "Full-body workout with low injury risk.",                "weekly_sessions": 3, "duration_min": 45},
    ],
    "Normal": [
        {"sport": "Swimming",          "intensity": "Moderate", "rationale": "Balanced full-body exercise.",                          "weekly_sessions": 3, "duration_min": 45},
        {"sport": "Cycling",           "intensity": "Moderate", "rationale": "Great cardiovascular and muscular conditioning.",       "weekly_sessions": 3, "duration_min": 50},
    ],
    "Overweight": [
        {"sport": "Walking",           "intensity": "Low",      "rationale": "Accessible and safe first step.",                       "weekly_sessions": 7, "duration_min": 35},
        {"sport": "Swimming",          "intensity": "Low",      "rationale": "Joint-friendly calorie burning.",                       "weekly_sessions": 3, "duration_min": 40},
    ],
    "Obese": [
        {"sport": "Walking",           "intensity": "Low",      "rationale": "Start here; build a sustainable movement habit.",       "weekly_sessions": 5, "duration_min": 25},
        {"sport": "Water Aerobics",    "intensity": "Low",      "rationale": "Safest cardiovascular option.",                        "weekly_sessions": 3, "duration_min": 30},
    ],
}


class SportRecommender:
    """
    Rule-based sport recommendation engine.

    Usage:
        rec = SportRecommender()
        sports = rec.recommend(bmi_category="Overweight", body_type="Wide Hip")
    """

    def recommend(
        self,
        bmi_category: str,
        body_type: str,
        top_n: int = 3,
    ) -> list[SportRecommendation]:
        """
        Return ranked sport recommendations.

        Args:
            bmi_category: "Underweight" | "Normal" | "Overweight" | "Obese".
            body_type:    "Lean/Athletic" | "Average/Balanced" | "Wide Hip" | "Unknown".
            top_n:        Maximum number of recommendations to return.

        Returns:
            List of SportRecommendation objects.
        """
        key = (bmi_category, body_type)
        raw = _RULES.get(key)

        if raw is None:
            # Try fallback by BMI category only
            raw = _FALLBACK.get(bmi_category, [])
            logger.warning(
                "No exact rule for (%s, %s). Using fallback.", bmi_category, body_type
            )

        recommendations = [SportRecommendation(**r) for r in raw[:top_n]]
        logger.info(
            "Recommended %d sports for (%s, %s)",
            len(recommendations), bmi_category, body_type,
        )
        return recommendations

    def recommend_as_dicts(
        self,
        bmi_category: str,
        body_type: str,
        top_n: int = 3,
    ) -> list[dict]:
        """Same as recommend() but returns plain dicts (for API responses)."""
        return [r.to_dict() for r in self.recommend(bmi_category, body_type, top_n)]
