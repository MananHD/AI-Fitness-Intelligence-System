"""
helpers.py – Shared utility functions used across the fitness AI system.

Covers: config loading, logging, frame manipulation, HUD rendering.
"""

from __future__ import annotations

import base64
import logging
import math
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import yaml

# ─── Config ───────────────────────────────────────────────────────────────────
_CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"


def load_config() -> dict[str, Any]:
    """Load and return the YAML config as a dict."""
    with open(_CONFIG_PATH, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


# ─── Logging ──────────────────────────────────────────────────────────────────
def get_logger(name: str) -> logging.Logger:
    """Return a consistently formatted logger."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  [%(levelname)-8s]  %(name)s – %(message)s",
        datefmt="%H:%M:%S",
    )
    return logging.getLogger(name)


# ─── Frame Utilities ──────────────────────────────────────────────────────────
def resize_frame(frame: np.ndarray, width: int = 640) -> np.ndarray:
    """Resize frame maintaining aspect ratio."""
    h, w = frame.shape[:2]
    scale = width / w
    return cv2.resize(frame, (width, int(h * scale)), interpolation=cv2.INTER_AREA)


def encode_frame_base64(frame: np.ndarray) -> str:
    """Encode BGR frame → base64 JPEG string (for API transport)."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.b64encode(buf).decode("utf-8")


def decode_base64_frame(b64_str: str) -> np.ndarray:
    """Decode base64 JPEG string → BGR numpy array."""
    arr = np.frombuffer(base64.b64decode(b64_str), dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


# ─── Colour Palette ───────────────────────────────────────────────────────────
COLORS: dict[str, tuple[int, int, int]] = {
    "green":  (0, 230, 100),
    "red":    (0, 60, 255),
    "yellow": (0, 210, 255),
    "white":  (240, 240, 240),
    "cyan":   (255, 210, 0),
    "dark":   (18, 18, 18),
    "blue":   (230, 100, 0),
}


# ─── HUD / Overlay Rendering ──────────────────────────────────────────────────
def draw_overlay(
    frame: np.ndarray,
    stats: dict[str, str],
    position: tuple[int, int] = (15, 30),
    font_scale: float = 0.62,
    line_height: int = 28,
    bg_alpha: float = 0.50,
) -> np.ndarray:
    """
    Render a semi-transparent stats panel in the top-left corner.

    Args:
        frame:       BGR numpy array.
        stats:       Ordered dict  { label: value }.
        position:    (x, y) top-left anchor.
        font_scale:  OpenCV font scale.
        line_height: Pixels between text lines.
        bg_alpha:    Background rectangle opacity.

    Returns:
        Annotated BGR frame (in-place modified).
    """
    if not stats:
        return frame

    font = cv2.FONT_HERSHEY_SIMPLEX
    x, y_start = position
    lines = [f"{k}: {v}" for k, v in stats.items()]
    pad = 10

    max_w = max(cv2.getTextSize(ln, font, font_scale, 1)[0][0] for ln in lines)
    panel_w = max_w + pad * 2
    panel_h = len(lines) * line_height + pad * 2

    overlay = frame.copy()
    cv2.rectangle(
        overlay,
        (x - pad, y_start - pad),
        (x + panel_w, y_start + panel_h),
        COLORS["dark"], -1,
    )
    cv2.addWeighted(overlay, bg_alpha, frame, 1 - bg_alpha, 0, frame)

    for i, line in enumerate(lines):
        y = y_start + i * line_height + line_height // 2
        cv2.putText(frame, line, (x + 1, y + 1), font, font_scale, (0, 0, 0), 2, cv2.LINE_AA)
        cv2.putText(frame, line, (x, y), font, font_scale, COLORS["green"], 1, cv2.LINE_AA)

    return frame


def draw_feedback_bar(
    frame: np.ndarray,
    message: str,
    color_key: str = "yellow",
) -> np.ndarray:
    """Draw a prominent feedback message centred at the bottom of the frame."""
    h, w = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale, thickness = 0.75, 2

    text_w, text_h = cv2.getTextSize(message, font, scale, thickness)[0]
    bar_y, pad = h - 50, 12

    overlay = frame.copy()
    cv2.rectangle(overlay, (0, bar_y - pad), (w, h), COLORS["dark"], -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

    x = (w - text_w) // 2
    cv2.putText(frame, message, (x + 1, bar_y + text_h // 2 + 1),
                font, scale, (0, 0, 0), thickness + 1, cv2.LINE_AA)
    cv2.putText(frame, message, (x, bar_y + text_h // 2),
                font, scale, COLORS.get(color_key, COLORS["yellow"]), thickness, cv2.LINE_AA)
    return frame


def draw_rep_counter(
    frame: np.ndarray,
    reps: int,
    stage: str,
    exercise: str,
) -> np.ndarray:
    """Draw a large rep counter box in the top-right corner."""
    h, w = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    box_w, box_h = 140, 90
    x0, y0 = w - box_w - 15, 15

    overlay = frame.copy()
    cv2.rectangle(overlay, (x0, y0), (x0 + box_w, y0 + box_h), COLORS["dark"], -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    cv2.rectangle(frame, (x0, y0), (x0 + box_w, y0 + box_h), COLORS["cyan"], 1)

    cv2.putText(frame, exercise.upper(), (x0 + 8, y0 + 18),
                font, 0.38, COLORS["cyan"], 1, cv2.LINE_AA)

    rep_str = str(reps)
    rep_x = x0 + box_w // 2 - cv2.getTextSize(rep_str, font, 1.8, 3)[0][0] // 2
    cv2.putText(frame, rep_str, (rep_x, y0 + 65),
                font, 1.8, COLORS["green"], 3, cv2.LINE_AA)

    stage_color = COLORS["yellow"] if stage == "DOWN" else COLORS["green"]
    cv2.putText(frame, stage, (x0 + 8, y0 + box_h - 8),
                font, 0.4, stage_color, 1, cv2.LINE_AA)
    return frame


def draw_angle_arc(
    frame: np.ndarray,
    point: tuple[int, int],
    angle: float,
    label: str = "",
) -> np.ndarray:
    """Draw a small angle value near a joint point."""
    cv2.putText(
        frame, f"{int(angle)}°",
        (int(point[0]) + 8, int(point[1]) - 8),
        cv2.FONT_HERSHEY_SIMPLEX, 0.50,
        COLORS["white"], 1, cv2.LINE_AA,
    )
    return frame
