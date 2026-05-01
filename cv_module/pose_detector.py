"""
pose_detector.py – MediaPipe Pose Landmarker wrapper (Tasks API).

Compatible with mediapipe >= 0.10.30 (Tasks API).
Downloads pose_landmarker_lite.task model on first use.
"""

from __future__ import annotations

import logging
import urllib.request
from pathlib import Path
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

from utils.helpers import load_config

logger = logging.getLogger(__name__)

# ── Tasks API references (accessed via attribute, not direct import) ──────────
_vision = mp.tasks.vision
PoseLandmarker     = _vision.PoseLandmarker
PoseLandmarkerOpts = _vision.PoseLandmarkerOptions
RunningMode        = _vision.RunningMode
BaseOptions        = mp.tasks.BaseOptions

# 33 canonical landmark names
_LANDMARK_NAMES: list[str] = [lm.name for lm in _vision.PoseLandmark]
_MIN_VISIBILITY = 0.50

# ── Model file ────────────────────────────────────────────────────────────────
_MODEL_URL  = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
)
_MODEL_PATH = Path(__file__).parent.parent / "database" / "pose_landmarker_lite.task"


def _ensure_model() -> str:
    """Download the pose landmarker .task model if not already cached."""
    if _MODEL_PATH.exists():
        return str(_MODEL_PATH)
    _MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading pose landmarker model → %s", _MODEL_PATH)
    urllib.request.urlretrieve(_MODEL_URL, str(_MODEL_PATH))
    logger.info("Model downloaded successfully.")
    return str(_MODEL_PATH)


# ── Connection pairs for skeleton drawing (MediaPipe standard) ─────────────────
_CONNECTIONS = [
    (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),   # arms
    (11, 23), (12, 24), (23, 24),                         # torso
    (23, 25), (25, 27), (24, 26), (26, 28),               # legs
    (27, 31), (28, 32),                                    # feet
]
_COLORS_LM  = (0, 230, 100)
_COLORS_CON = (0, 180, 255)


class PoseDetector:
    """
    Wraps MediaPipe Tasks PoseLandmarker for body landmark detection.

    Landmark dictionary format:
        { "LEFT_SHOULDER": [x_px, y_px, z, visibility], ... }

    Usage:
        detector = PoseDetector()
        landmarks, annotated = detector.detect(bgr_frame)
        detector.close()
    """

    def __init__(
        self,
        min_detection_confidence: float = 0.70,
        min_tracking_confidence:  float = 0.70,
        model_complexity: int = 1,       # ignored; kept for API compat
        static_image_mode: bool = False,
    ) -> None:
        cfg = load_config().get("mediapipe", {})
        self._min_det = cfg.get("min_detection_confidence", min_detection_confidence)
        self._static  = static_image_mode
        self._frame_ts: int = 0    # monotonic ms counter for VIDEO mode

        model_path = _ensure_model()
        mode = RunningMode.IMAGE if static_image_mode else RunningMode.VIDEO
        opts = PoseLandmarkerOpts(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=mode,
            min_pose_detection_confidence=self._min_det,
            min_pose_presence_confidence=self._min_det,
            num_poses=1,
        )
        self._landmarker = PoseLandmarker.create_from_options(opts)
        logger.info("PoseDetector ready  static=%s", static_image_mode)

    # ─── Public API ───────────────────────────────────────────────────────────

    def detect(
        self, frame: np.ndarray
    ) -> tuple[Optional[dict[str, list[float]]], np.ndarray]:
        """
        Run pose detection on a BGR video frame.

        Returns (landmarks_dict, annotated_frame).
        landmarks_dict is None when no pose is detected.
        """
        annotated = frame.copy()
        mp_img = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
        )

        if self._static:
            result = self._landmarker.detect(mp_img)
        else:
            self._frame_ts += 33
            result = self._landmarker.detect_for_video(mp_img, self._frame_ts)

        if not result.pose_landmarks:
            return None, annotated

        lm_list = result.pose_landmarks[0]
        landmarks = self._extract(lm_list, frame.shape)
        self._draw(annotated, lm_list, frame.shape)
        return landmarks, annotated

    def detect_static(
        self, frame: np.ndarray
    ) -> tuple[Optional[dict[str, list[float]]], np.ndarray]:
        """Run pose detection on a static image (IMAGE running mode)."""
        model_path = _ensure_model()
        annotated  = frame.copy()
        mp_img     = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
        )
        opts = PoseLandmarkerOpts(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=RunningMode.IMAGE,
            min_pose_detection_confidence=self._min_det,
            num_poses=1,
        )
        with PoseLandmarker.create_from_options(opts) as det:
            result = det.detect(mp_img)

        if not result.pose_landmarks:
            return None, annotated

        lm_list = result.pose_landmarks[0]
        landmarks = self._extract(lm_list, frame.shape)
        self._draw(annotated, lm_list, frame.shape)
        return landmarks, annotated

    def close(self) -> None:
        """Release MediaPipe resources."""
        self._landmarker.close()

    def __enter__(self) -> "PoseDetector":
        return self

    def __exit__(self, *_) -> None:
        self.close()

    # ─── Private ──────────────────────────────────────────────────────────────

    def _extract(
        self,
        lm_list: list,
        shape: tuple[int, int, int],
    ) -> dict[str, list[float]]:
        """Convert normalised landmark list → pixel-coord named dict."""
        h, w, _ = shape
        result: dict[str, list[float]] = {}
        for idx, lm in enumerate(lm_list):
            vis = float(getattr(lm, "visibility", 1.0) or 0.0)
            if vis >= _MIN_VISIBILITY:
                result[_LANDMARK_NAMES[idx]] = [lm.x * w, lm.y * h, lm.z, vis]
        return result

    def _draw(
        self,
        frame: np.ndarray,
        lm_list: list,
        shape: tuple[int, int, int],
    ) -> None:
        """Draw skeleton (keypoints + connections) directly with OpenCV."""
        h, w, _ = shape
        pts: list[Optional[tuple[int, int]]] = []
        for lm in lm_list:
            vis = float(getattr(lm, "visibility", 1.0) or 0.0)
            if vis >= _MIN_VISIBILITY:
                pts.append((int(lm.x * w), int(lm.y * h)))
            else:
                pts.append(None)

        # Connections
        for a, b in _CONNECTIONS:
            if a < len(pts) and b < len(pts) and pts[a] and pts[b]:
                cv2.line(frame, pts[a], pts[b], _COLORS_CON, 2, cv2.LINE_AA)

        # Keypoints
        for p in pts:
            if p:
                cv2.circle(frame, p, 4, _COLORS_LM, -1, cv2.LINE_AA)
                cv2.circle(frame, p, 6, (255, 255, 255), 1, cv2.LINE_AA)
