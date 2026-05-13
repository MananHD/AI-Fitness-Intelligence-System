"""
predict.py – Inference: photo → top-3 sport matches (mediapipe >= 0.10).

Threshold pipeline:
  1. Decode image.
  2. Run MediaPipe PoseLandmarker (Tasks API).
  3. Check ≥12/14 key landmarks visible (confidence ≥ 0.50).
  4. Compute 12 biometric ratios.
  5. Run gender-specific Random Forest → class probabilities.
  6. Return top-3 sports with percentage confidence.
"""

from __future__ import annotations

import base64
import pickle
from pathlib import Path
from typing import Literal

import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode
import numpy as np

from ml_pipeline.feature_extractor import (
    FEATURE_NAMES,
    LM,
    VISIBILITY_THRESHOLD,
    MIN_VISIBLE_KEY_LANDMARKS,
    extract_features_from_landmarks,
)

MODEL_DIR  = Path("ml_pipeline/models")
POSE_MODEL = "database/pose_landmarker_lite.task"
SUPPORTED_SPORTS = [
    "archery",
    "athletics",
    "badminton",
    "basketball",
    "cricket",
    "field_hockey",
    "football",
    "kabaddi",
    "shooting",
    "volleyball",
    "weightlifting",
    "wrestling",
]
RULE_WEIGHT = 0.45
RATIO_WEIGHT = 0.35
ML_WEIGHT = 0.20


class PoseQualityError(ValueError):
    """Image did not pass pose quality thresholds."""


class ModelNotReadyError(RuntimeError):
    """ML model has not been trained yet."""


def _make_landmarker() -> PoseLandmarker:
    opts = PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=POSE_MODEL),
        running_mode=RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return PoseLandmarker.create_from_options(opts)


class SportPredictor:
    def __init__(self) -> None:
        self._models:   dict = {}
        self._encoders: dict = {}
        self._landmarker = _make_landmarker()
        self._load_models()

    def _load_models(self) -> None:
        for gender in ("male", "female"):
            m = MODEL_DIR / f"{gender}_model.pkl"
            e = MODEL_DIR / f"{gender}_encoder.pkl"
            if m.exists() and e.exists():
                with open(m, "rb") as f:
                    self._models[gender] = pickle.load(f)
                with open(e, "rb") as f:
                    self._encoders[gender] = pickle.load(f)

    def is_ready(self, gender: str) -> bool:
        return gender in self._models

    @staticmethod
    def _bmi(weight_kg: float | None, height_cm: float | None) -> float | None:
        if not weight_kg or not height_cm or weight_kg <= 0 or height_cm <= 0:
            return None
        height_m = height_cm / 100.0
        return weight_kg / (height_m * height_m)

    @staticmethod
    def _add(scores: dict[str, float], sports: list[str], points: float) -> None:
        for sport in sports:
            if sport in scores:
                scores[sport] += points

    @classmethod
    def _rule_scores(cls, height_cm: float | None, weight_kg: float | None) -> dict[str, float]:
        scores = {sport: 50.0 for sport in SUPPORTED_SPORTS}
        bmi = cls._bmi(weight_kg, height_cm)

        if bmi is not None:
            if bmi < 18.5:
                cls._add(scores, ["archery", "shooting", "badminton", "cricket"], 14)
                cls._add(scores, ["athletics", "football", "volleyball"], 4)
                cls._add(scores, ["wrestling", "kabaddi", "weightlifting"], -12)
            elif bmi < 25.0:
                cls._add(scores, SUPPORTED_SPORTS, 6)
            elif bmi < 30.0:
                cls._add(scores, ["archery", "shooting", "cricket", "weightlifting"], 12)
                cls._add(scores, ["kabaddi", "wrestling"], 5)
                cls._add(scores, ["athletics", "basketball", "football", "volleyball"], -10)
            else:
                cls._add(scores, ["archery", "shooting"], 16)
                cls._add(scores, ["cricket", "weightlifting"], 4)
                cls._add(scores, ["athletics", "basketball", "football", "volleyball", "kabaddi", "wrestling"], -18)

        if height_cm is not None and height_cm > 0:
            if height_cm < 165:
                cls._add(scores, ["wrestling", "kabaddi", "shooting"], 10)
                cls._add(scores, ["weightlifting"], 4)
                cls._add(scores, ["basketball", "volleyball"], -12)
            elif height_cm <= 180:
                cls._add(scores, ["cricket", "football", "badminton", "field_hockey", "athletics"], 9)
            elif height_cm <= 190:
                cls._add(scores, ["basketball", "volleyball", "athletics", "football"], 14)
                cls._add(scores, ["wrestling", "kabaddi"], -5)
            else:
                cls._add(scores, ["basketball", "volleyball"], 20)
                cls._add(scores, ["wrestling", "kabaddi", "weightlifting"], -10)

        if weight_kg is not None and weight_kg > 0:
            if weight_kg < 55:
                cls._add(scores, ["badminton", "athletics", "shooting", "archery"], 7)
                cls._add(scores, ["wrestling", "kabaddi", "weightlifting"], -8)
            elif weight_kg > 85 and (bmi is None or bmi < 30):
                cls._add(scores, ["weightlifting", "wrestling", "kabaddi"], 8)

        return {sport: float(np.clip(score, 5.0, 95.0)) for sport, score in scores.items()}

    @classmethod
    def _ratio_scores(cls, feats: dict) -> dict[str, float]:
        scores = {sport: 50.0 for sport in SUPPORTED_SPORTS}
        shoulder_hip = float(feats.get("shoulder_hip_ratio", 1.0))
        crural = float(feats.get("crural_index", 1.0))
        ape = float(feats.get("ape_index", 0.5))
        upper_body = float(feats.get("upper_body_ratio", 0.35))
        torso = float(feats.get("torso_ratio", 0.3))

        if shoulder_hip >= 1.88:
            cls._add(scores, ["basketball", "volleyball", "football", "wrestling", "weightlifting"], 12)
            cls._add(scores, ["archery", "shooting"], -4)
        elif shoulder_hip <= 1.58:
            cls._add(scores, ["archery", "shooting", "cricket", "badminton"], 8)

        if crural >= 1.02:
            cls._add(scores, ["athletics", "basketball", "football", "volleyball", "field_hockey"], 12)
        elif crural <= 0.80:
            cls._add(scores, ["wrestling", "kabaddi", "weightlifting"], 10)

        if ape >= 0.76:
            cls._add(scores, ["basketball", "volleyball", "archery", "cricket"], 10)

        if upper_body >= 0.53 or torso >= 0.40:
            cls._add(scores, ["weightlifting", "wrestling", "kabaddi"], 9)
            cls._add(scores, ["badminton", "athletics"], -4)

        return {sport: float(np.clip(score, 5.0, 95.0)) for sport, score in scores.items()}

    @staticmethod
    def _ml_scores(classes: np.ndarray, proba: np.ndarray) -> dict[str, float]:
        scores = {sport: 50.0 for sport in SUPPORTED_SPORTS}
        for sport, prob in zip(classes, proba):
            sport_key = str(sport)
            if sport_key in scores:
                scores[sport_key] = float(np.clip(45.0 + float(prob) * 70.0, 5.0, 95.0))
        return scores

    @staticmethod
    def _rescale_top_scores(ranked: list[tuple[str, float]]) -> list[tuple[str, float]]:
        if not ranked:
            return []
        raw_values = [score for _, score in ranked]
        min_raw = min(raw_values)
        max_raw = max(raw_values)
        scaled = []
        for pos, (sport, score) in enumerate(ranked):
            if max_raw == min_raw:
                display = 62.0 - pos * 4.0
            else:
                norm = (score - min_raw) / (max_raw - min_raw)
                display = 48.0 + norm * 17.0
            scaled.append((sport, round(float(np.clip(display, 45.0, 68.0)), 1)))

        if len(scaled) > 1 and scaled[1][1] < 58.0:
            scaled[1] = (scaled[1][0], 58.0)
        for i in range(1, len(scaled)):
            if scaled[i][1] >= scaled[i - 1][1]:
                scaled[i] = (scaled[i][0], round(max(45.0, scaled[i - 1][1] - 2.0), 1))
        return scaled

    def _extract(self, img_bgr: np.ndarray) -> tuple[dict, dict]:
        h, w = img_bgr.shape[:2]
        rgb   = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_img)

        if not result.pose_landmarks:
            raise PoseQualityError(
                "No person detected. Use a clear full-body photo with good lighting."
            )

        landmarks = result.pose_landmarks[0]
        feats = extract_features_from_landmarks(landmarks, h, w)
        if feats is None:
            raise PoseQualityError(
                f"Pose quality check failed: fewer than {MIN_VISIBLE_KEY_LANDMARKS} "
                f"landmarks visible (threshold={VISIBILITY_THRESHOLD}). "
                "Please use a clearer full-body image."
            )
        keypoints = {
            name: {
                "x": round(float(landmarks[idx].x), 4),
                "y": round(float(landmarks[idx].y), 4),
                "visibility": round(float(getattr(landmarks[idx], "visibility", 1.0)), 4),
            }
            for name, idx in LM.items()
        }
        return feats, keypoints

    def predict_from_array(
        self,
        img_bgr: np.ndarray,
        gender: Literal["male", "female"] = "male",
        height_cm: float | None = None,
        weight_kg: float | None = None,
    ) -> dict:
        if not self.is_ready(gender):
            raise ModelNotReadyError(
                f"No model for '{gender}'. Run `python -m ml_pipeline.train_model`."
            )

        feats, keypoints = self._extract(img_bgr)
        X       = np.array([[feats[f] for f in FEATURE_NAMES]])
        proba   = self._models[gender].predict_proba(X)[0]
        classes = self._encoders[gender].classes_
        rule_scores = self._rule_scores(height_cm, weight_kg)
        ratio_scores = self._ratio_scores(feats)
        ml_scores = self._ml_scores(classes, proba)
        combined = {
            sport: (
                RULE_WEIGHT * rule_scores[sport]
                + RATIO_WEIGHT * ratio_scores[sport]
                + ML_WEIGHT * ml_scores[sport]
            )
            for sport in SUPPORTED_SPORTS
        }
        ranked = sorted(combined.items(), key=lambda item: item[1], reverse=True)
        top3 = self._rescale_top_scores(ranked[:3])
        bmi = self._bmi(weight_kg, height_cm)

        return {
            "status":   "ok",
            "top3":     top3,
            "features": {k: round(v, 4) for k, v in feats.items()},
            "pose_landmarks": keypoints,
            "scoring": {
                "bmi": round(bmi, 2) if bmi is not None else None,
                "weights": {"rules": RULE_WEIGHT, "ratios": RATIO_WEIGHT, "ml": ML_WEIGHT},
            },
        }

    def predict_from_bytes(
        self,
        image_bytes: bytes,
        gender: str = "male",
        height_cm: float | None = None,
        weight_kg: float | None = None,
    ) -> dict:
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image.")
        return self.predict_from_array(img, gender, height_cm=height_cm, weight_kg=weight_kg)

    def predict_from_base64(
        self,
        b64_str: str,
        gender: str = "male",
        height_cm: float | None = None,
        weight_kg: float | None = None,
    ) -> dict:
        return self.predict_from_bytes(
            base64.b64decode(b64_str),
            gender,
            height_cm=height_cm,
            weight_kg=weight_kg,
        )

    def close(self) -> None:
        self._landmarker.close()


_predictor: SportPredictor | None = None


def get_predictor() -> SportPredictor:
    global _predictor
    if _predictor is None:
        _predictor = SportPredictor()
    return _predictor
