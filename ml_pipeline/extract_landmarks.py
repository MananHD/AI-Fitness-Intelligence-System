"""
extract_landmarks.py – Batch-process data_sports/ using MediaPipe Tasks API.

Usage:
    python -m ml_pipeline.extract_landmarks
"""

from __future__ import annotations
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode
import pandas as pd

from ml_pipeline.feature_extractor import extract_features_from_landmarks, FEATURE_NAMES

SPORT_ALIAS: dict[str, str] = {
    "atheletics":       "athletics",
    "feild_hockey":     "field_hockey",
    "wrestling(kusti)": "wrestling",
    "kabbadi":          "kabaddi",
}

DATASET_ROOT = Path("data_sports")
OUTPUT_DIR   = Path("ml_pipeline/data")
MODEL_PATH   = "database/pose_landmarker_lite.task"
IMAGE_EXTS   = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _norm_sport(name: str) -> str:
    key = name.lower().strip()
    return SPORT_ALIAS.get(key, key)


def _make_landmarker() -> PoseLandmarker:
    opts = PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return PoseLandmarker.create_from_options(opts)


def process_gender(gender: str) -> pd.DataFrame:
    gender_path = DATASET_ROOT / gender
    if not gender_path.exists():
        print("  [WARN] %s not found - skipping." % gender_path)
        return pd.DataFrame()

    landmarker = _make_landmarker()
    rows: list[dict] = []
    total = success = 0

    for sport_dir in sorted(d for d in gender_path.iterdir() if d.is_dir()):
        sport = _norm_sport(sport_dir.name)
        images = [f for f in sport_dir.iterdir() if f.suffix.lower() in IMAGE_EXTS]
        sport_ok = 0

        for img_path in images:
            total += 1
            img_bgr = cv2.imread(str(img_path))
            if img_bgr is None:
                continue

            h, w = img_bgr.shape[:2]
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

            result = landmarker.detect(mp_image)
            if not result.pose_landmarks:
                continue

            landmarks = result.pose_landmarks[0]
            feats = extract_features_from_landmarks(landmarks, h, w)
            if feats is None:
                continue

            feats["sport"]  = sport
            feats["gender"] = gender
            rows.append(feats)
            success += 1
            sport_ok += 1

        print("    %s/%s: %d/%d OK" % (gender, sport, sport_ok, len(images)))

    landmarker.close()
    print("\n  [%s] %d/%d images processed\n" % (gender.upper(), success, total))
    return pd.DataFrame(rows)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for gender in ("male", "female"):
        out = OUTPUT_DIR / ("%s_features.csv" % gender)

        print("\n" + "=" * 55)
        print("  Processing: %s" % gender.upper())
        print("=" * 55)

        df = process_gender(gender)
        if df.empty:
            print("  No valid data for %s." % gender)
            continue

        df.to_csv(out, index=False)
        print("  Saved %d rows -> %s" % (len(df), out))
        print("  Distribution:\n%s\n" % df["sport"].value_counts().to_string())


if __name__ == "__main__":
    main()
