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
    VISIBILITY_THRESHOLD,
    MIN_VISIBLE_KEY_LANDMARKS,
    extract_features_from_landmarks,
)

MODEL_DIR  = Path("ml_pipeline/models")
POSE_MODEL = "database/pose_landmarker_lite.task"


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

    def _extract(self, img_bgr: np.ndarray) -> dict:
        h, w = img_bgr.shape[:2]
        rgb   = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_img)

        if not result.pose_landmarks:
            raise PoseQualityError(
                "No person detected. Use a clear full-body photo with good lighting."
            )

        feats = extract_features_from_landmarks(result.pose_landmarks[0], h, w)
        if feats is None:
            raise PoseQualityError(
                f"Pose quality check failed: fewer than {MIN_VISIBLE_KEY_LANDMARKS} "
                f"landmarks visible (threshold={VISIBILITY_THRESHOLD}). "
                "Please use a clearer full-body image."
            )
        return feats

    def predict_from_array(
        self,
        img_bgr: np.ndarray,
        gender: Literal["male", "female"] = "male",
    ) -> dict:
        if not self.is_ready(gender):
            raise ModelNotReadyError(
                f"No model for '{gender}'. Run `python -m ml_pipeline.train_model`."
            )

        feats   = self._extract(img_bgr)
        X       = np.array([[feats[f] for f in FEATURE_NAMES]])
        proba   = self._models[gender].predict_proba(X)[0]
        classes = self._encoders[gender].classes_

        top_idx = np.argsort(proba)[::-1][:3]
        top3    = [
            (classes[i], round(float(proba[i]) * 100, 1))
            for i in top_idx if proba[i] > 0
        ]

        return {
            "status":   "ok",
            "top3":     top3,
            "features": {k: round(v, 4) for k, v in feats.items()},
        }

    def predict_from_bytes(self, image_bytes: bytes, gender: str = "male") -> dict:
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image.")
        return self.predict_from_array(img, gender)

    def predict_from_base64(self, b64_str: str, gender: str = "male") -> dict:
        return self.predict_from_bytes(base64.b64decode(b64_str), gender)

    def close(self) -> None:
        self._landmarker.close()


_predictor: SportPredictor | None = None


def get_predictor() -> SportPredictor:
    global _predictor
    if _predictor is None:
        _predictor = SportPredictor()
    return _predictor
