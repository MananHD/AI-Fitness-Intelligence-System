"""
train_model.py – Train gender-specific sport classifiers.

Reads:
    ml_pipeline/data/male_features.csv
    ml_pipeline/data/female_features.csv

Writes:
    ml_pipeline/models/{male,female}_model.pkl
    ml_pipeline/models/{male,female}_encoder.pkl
    ml_pipeline/models/model_report.txt

Usage:
    python -m ml_pipeline.train_model
"""

from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, classification_report, top_k_accuracy_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC

from ml_pipeline.feature_extractor import FEATURE_NAMES

DATA_DIR  = Path("ml_pipeline/data")
MODEL_DIR = Path("ml_pipeline/models")

MIN_SAMPLES_PER_CLASS = 3   # Drop sports with fewer samples
SYNTHETIC_TARGET_PER_CLASS = {
    "male": 40,
    "female": 35,
}
SYNTHETIC_NOISE_SCALE = 0.04


def load_gender_data(gender: str) -> tuple[np.ndarray, np.ndarray, LabelEncoder]:
    path = DATA_DIR / f"{gender}_features.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run `python -m ml_pipeline.extract_landmarks` first."
        )

    df = pd.read_csv(path).dropna(subset=FEATURE_NAMES)

    # Drop under-represented classes
    counts = df["sport"].value_counts()
    valid  = counts[counts >= MIN_SAMPLES_PER_CLASS].index
    df = df[df["sport"].isin(valid)].copy()
    print(f"  [{gender}] {len(df)} samples | {df['sport'].nunique()} sports")
    print(df["sport"].value_counts().to_string())

    le    = LabelEncoder()
    X     = df[FEATURE_NAMES].values.astype(float)
    y_enc = le.fit_transform(df["sport"].values)
    return X, y_enc, le


def _build_extra_trees(cfg: dict) -> Pipeline:
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            ("clf", ExtraTreesClassifier(
                n_estimators=cfg["n_estimators"],
                criterion=cfg["criterion"],
                max_features=cfg["max_features"],
                min_samples_leaf=cfg["min_samples_leaf"],
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
            )),
        ]
    )


def get_candidate_models() -> list[tuple[str, Pipeline]]:
    models: list[tuple[str, Pipeline | VotingClassifier]] = [
        (
            "extra_trees_a",
            _build_extra_trees({
                "n_estimators": 600,
                "criterion": "entropy",
                "max_features": "sqrt",
                "min_samples_leaf": 1,
            }),
        ),
        (
            "extra_trees_b",
            _build_extra_trees({
                "n_estimators": 1000,
                "criterion": "gini",
                "max_features": None,
                "min_samples_leaf": 1,
            }),
        ),
        (
            "svc_rbf",
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    ("clf", SVC(C=5.0, kernel="rbf", gamma="scale", class_weight="balanced", probability=True)),
                ]
            ),
        ),
        (
            "knn_dist",
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    ("clf", KNeighborsClassifier(n_neighbors=7, weights="distance")),
                ]
            ),
        ),
        (
            "soft_vote_ensemble",
            VotingClassifier(
                estimators=[
                    (
                        "et",
                        _build_extra_trees({
                            "n_estimators": 700,
                            "criterion": "entropy",
                            "max_features": "sqrt",
                            "min_samples_leaf": 1,
                        }),
                    ),
                    (
                        "svc",
                        Pipeline(
                            [
                                ("scaler", StandardScaler()),
                                ("clf", SVC(C=5.0, kernel="rbf", gamma="scale", class_weight="balanced", probability=True)),
                            ]
                        ),
                    ),
                    (
                        "knn",
                        Pipeline(
                            [
                                ("scaler", StandardScaler()),
                                ("clf", KNeighborsClassifier(n_neighbors=7, weights="distance")),
                            ]
                        ),
                    ),
                ],
                voting="soft",
                weights=[2, 1, 1],
                n_jobs=-1,
            ),
        ),
    ]
    return models


def augment_training_data(
    X: np.ndarray, y: np.ndarray, *, target_per_class: int, random_state: int = 42
) -> tuple[np.ndarray, np.ndarray, int]:
    """
    Expand minority classes via ratio-space synthesis.
    Strategy:
      1) bootstrap + interpolation between same-class samples
      2) add small gaussian jitter scaled by class std
    """
    rng = np.random.default_rng(random_state)
    classes = np.unique(y)
    X_aug_parts = [X]
    y_aug_parts = [y]
    synthetic_rows = 0

    for cls in classes:
        idx = np.where(y == cls)[0]
        class_X = X[idx]
        n_current = len(class_X)
        if n_current >= target_per_class:
            continue

        n_needed = target_per_class - n_current
        class_std = class_X.std(axis=0)
        class_std = np.where(class_std < 1e-4, 1e-4, class_std)

        synth = []
        for _ in range(n_needed):
            i1 = int(rng.integers(0, n_current))
            i2 = int(rng.integers(0, n_current))
            lam = float(rng.uniform(0.25, 0.75))
            base = lam * class_X[i1] + (1.0 - lam) * class_X[i2]
            noise = rng.normal(0.0, SYNTHETIC_NOISE_SCALE * class_std)
            row = np.clip(base + noise, 1e-6, None)
            synth.append(row)

        synth = np.asarray(synth, dtype=float)
        X_aug_parts.append(synth)
        y_aug_parts.append(np.full(n_needed, cls, dtype=y.dtype))
        synthetic_rows += n_needed

    X_aug = np.vstack(X_aug_parts)
    y_aug = np.concatenate(y_aug_parts)
    return X_aug, y_aug, synthetic_rows


def evaluate_cv_model(model, X: np.ndarray, y: np.ndarray, n_classes: int, n_folds: int) -> dict:
    cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    top1_scores: list[float] = []
    top3_scores: list[float] = []

    for train_idx, test_idx in cv.split(X, y):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)
        top1_scores.append(float(accuracy_score(y_test, y_pred)))
        top3_scores.append(
            float(top_k_accuracy_score(y_test, y_proba, k=min(3, n_classes), labels=np.arange(n_classes)))
        )

    return {
        "cv_top1_mean": float(np.mean(top1_scores)),
        "cv_top1_std": float(np.std(top1_scores)),
        "cv_top3_mean": float(np.mean(top3_scores)),
        "cv_top3_std": float(np.std(top3_scores)),
    }


def select_best_model(
    X_train: np.ndarray,
    y_train: np.ndarray,
    n_classes: int,
) -> tuple[str, object, dict]:
    n_folds = min(5, len(X_train) // max(n_classes, 1))
    n_folds = max(n_folds, 2)

    best_name = ""
    best_model: Pipeline | None = None
    best_metrics: dict | None = None

    print("  Model search (CV on training split):")
    for name, model in get_candidate_models():
        metrics = evaluate_cv_model(model, X_train, y_train, n_classes=n_classes, n_folds=n_folds)
        print(
            f"    {name}: top1={metrics['cv_top1_mean']:.3f} +/- {metrics['cv_top1_std']:.3f}, "
            f"top3={metrics['cv_top3_mean']:.3f} +/- {metrics['cv_top3_std']:.3f}"
        )
        if best_metrics is None:
            best_name, best_model, best_metrics = name, model, metrics
            continue

        better_top3 = metrics["cv_top3_mean"] > best_metrics["cv_top3_mean"]
        same_top3_better_top1 = (
            metrics["cv_top3_mean"] == best_metrics["cv_top3_mean"]
            and metrics["cv_top1_mean"] > best_metrics["cv_top1_mean"]
        )
        if better_top3 or same_top3_better_top1:
            best_name, best_model, best_metrics = name, model, metrics

    assert best_model is not None and best_metrics is not None
    return best_name, best_model, best_metrics


def train_gender(gender: str) -> dict:
    print(f"\n{'='*55}")
    print(f"  Training: {gender.upper()}")
    print(f"{'='*55}")

    X, y, le = load_gender_data(gender)
    n_classes = len(le.classes_)

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=42,
        stratify=y if len(X) >= n_classes * 2 else None,
    )
    X_tr_aug, y_tr_aug, synth_count = augment_training_data(
        X_tr, y_tr, target_per_class=SYNTHETIC_TARGET_PER_CLASS[gender], random_state=42
    )
    print(f"  Synthetic rows added: {synth_count}")
    print(f"  Train size (orig -> aug): {len(X_tr)} -> {len(X_tr_aug)}")

    best_name_raw, model_raw, cv_raw = select_best_model(X_tr, y_tr, n_classes=n_classes)
    model_raw.fit(X_tr, y_tr)
    y_raw = model_raw.predict(X_te)
    y_raw_proba = model_raw.predict_proba(X_te)
    raw_test_acc = accuracy_score(y_te, y_raw)
    raw_top3_acc = top_k_accuracy_score(y_te, y_raw_proba, k=min(3, n_classes))

    best_name_aug, model_aug, cv_aug = select_best_model(X_tr_aug, y_tr_aug, n_classes=n_classes)
    model_aug.fit(X_tr_aug, y_tr_aug)
    y_aug = model_aug.predict(X_te)
    y_aug_proba = model_aug.predict_proba(X_te)
    aug_test_acc = accuracy_score(y_te, y_aug)
    aug_top3_acc = top_k_accuracy_score(y_te, y_aug_proba, k=min(3, n_classes))

    use_augmented = (aug_top3_acc > raw_top3_acc) or (
        aug_top3_acc == raw_top3_acc and aug_test_acc > raw_test_acc
    )
    model = model_aug if use_augmented else model_raw
    selected_cv = cv_aug if use_augmented else cv_raw
    selected_model_name = best_name_aug if use_augmented else best_name_raw
    print(
        "  Selected training set: "
        + ("synthetic-augmented" if use_augmented else "original (no synth)")
    )
    print(f"  Selected model: {selected_model_name}")
    print(f"  Raw   holdout: top-1={raw_test_acc:.3f}, top-3={raw_top3_acc:.3f}")
    print(f"  Synth holdout: top-1={aug_test_acc:.3f}, top-3={aug_top3_acc:.3f}")

    y_pred   = model.predict(X_te)
    y_proba  = model.predict_proba(X_te)
    test_acc = accuracy_score(y_te, y_pred)
    top3_acc = top_k_accuracy_score(y_te, y_proba, k=min(3, n_classes))
    top5_acc = top_k_accuracy_score(y_te, y_proba, k=min(5, n_classes))
    top6_acc = top_k_accuracy_score(y_te, y_proba, k=min(6, n_classes))
    print(f"\n  Test accuracy (Top-1): {test_acc:.3f}")
    print(f"  Top-3 accuracy: {top3_acc:.3f}")
    print(f"  Top-5 accuracy: {top5_acc:.3f}")
    print(f"  Top-6 accuracy: {top6_acc:.3f}")
    print(classification_report(y_te, y_pred, target_names=le.classes_, zero_division=0))

    print(
        f"  CV (selected model): top1={selected_cv['cv_top1_mean']:.3f} +/- {selected_cv['cv_top1_std']:.3f}, "
        f"top3={selected_cv['cv_top3_mean']:.3f} +/- {selected_cv['cv_top3_std']:.3f}"
    )

    # Persist
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_DIR / f"{gender}_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(MODEL_DIR / f"{gender}_encoder.pkl", "wb") as f:
        pickle.dump(le, f)

    print(f"\n  Saved -> ml_pipeline/models/{gender}_model.pkl")

    return {
        "gender":    gender,
        "samples":   len(X),
        "synthetic_rows": synth_count,
        "used_synthetic": use_augmented,
        "selected_model": selected_model_name,
        "sports":    list(le.classes_),
        "test_acc":  round(test_acc, 4),
        "top3_acc":  round(float(top3_acc), 4),
        "top5_acc":  round(float(top5_acc), 4),
        "top6_acc":  round(float(top6_acc), 4),
        "cv_top1_acc": round(float(selected_cv["cv_top1_mean"]), 4),
        "cv_top3_acc": round(float(selected_cv["cv_top3_mean"]), 4),
    }


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    for gender in ("male", "female"):
        try:
            info = train_gender(gender)
            results.append(info)
        except Exception as exc:
            print(f"\n  [ERROR] {gender}: {exc}")
            results.append({"gender": gender, "error": str(exc)})

    # Write plain-text report
    report_path = MODEL_DIR / "model_report.txt"
    lines = ["Sport-Classification Model Training Report", "=" * 55]
    for r in results:
        lines.append(f"\n[{r['gender'].upper()}]")
        if "error" in r:
            lines.append(f"  ERROR: {r['error']}")
        else:
            lines.append(f"  Samples  : {r['samples']}")
            lines.append(f"  Synth rows: {r['synthetic_rows']}")
            lines.append(f"  Used synth: {r['used_synthetic']}")
            lines.append(f"  Sports   : {', '.join(r['sports'])}")
            lines.append(f"  Model    : {r['selected_model']}")
            lines.append(f"  Test acc : {r['test_acc']}")
            lines.append(f"  Top-3 acc: {r['top3_acc']}")
            lines.append(f"  Top-5 acc: {r['top5_acc']}")
            lines.append(f"  Top-6 acc: {r['top6_acc']}")
            lines.append(f"  CV top1  : {r['cv_top1_acc']}")
            lines.append(f"  CV top3  : {r['cv_top3_acc']}")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nReport -> {report_path}")


if __name__ == "__main__":
    main()
