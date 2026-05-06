# 🏋️ AI-Powered Personalized Sports, Diet & Exercise Intelligence System

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.8+-green.svg)](https://opencv.org)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-0.10+-orange.svg)](https://mediapipe.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-teal.svg)](https://fastapi.tiangolo.com)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.28+-red.svg)](https://streamlit.io)
[![SQLite](https://img.shields.io/badge/Database-SQLite-lightgrey.svg)](https://sqlite.org)

> **Computer Vision-centric** fitness intelligence platform that analyses your body,
> tracks your workouts in real-time, and delivers personalised sport & diet recommendations.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [System Architecture](#system-architecture)
4. [Project Structure](#project-structure)
5. [Installation](#installation)
6. [Running the System](#running-the-system)
7. [Module Breakdown](#module-breakdown)
8. [API Endpoints](#api-endpoints)
9. [Example Outputs](#example-outputs)
10. [Future Scope](#future-scope)

---

## 🎯 Project Overview

This system uses **OpenCV + MediaPipe** to extract 33 body landmarks in real-time,
then applies geometric angle calculations, BMI logic, and rule-based engines to deliver:

- 🔎 **Body Analysis** — BMI, WHO classification, shoulder-hip ratio from pose landmarks
- 🏃 **Exercise Tracking** — Rep counting for squats, push-ups, jumping jacks with posture cues
- 🏅 **Sport Recommendations** — Matched to your BMI category and body type
- 🥗 **Diet Plans** — 12 structured meal plan templates (veg / non-veg / vegan)
- 📊 **Progress Tracking** — SQLite-backed history with Plotly charts

---

## ✨ Features

| Feature | Details |
|---|---|
| **Pose Detection** | MediaPipe Pose, 33 keypoints, 0.70 confidence threshold |
| **Angle Engine** | `calculate_angle(A, B, C)` reusable for any joint |
| **Squat Tracker** | Knee angle state machine + torso lean warning |
| **Push-up Tracker** | Elbow angle + shoulder level check |
| **Jumping Jack Tracker** | Arm abduction + ankle spread ratio |
| **BMI Analysis** | WHO formula + body type from shoulder/hip ratio |
| **Sport Engine** | Rule table covering 12 BMI × body-type combinations |
| **Diet Engine** | 12 BMI × diet-pref templates + calorie/protein targets |
| **REST API** | 12 FastAPI endpoints, JSON in/out |
| **Streamlit UI** | 6-page dark-mode app with Plotly charts |
| **SQLite Persistence** | 4 tables: users, sessions, exercise_logs, progress_snapshots |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    INTERFACE LAYER                       │
│          Streamlit UI (6 pages)  +  FastAPI REST API     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    BACKEND LAYER                         │
│         FastAPI  ·  CORS  ·  Lifespan DB Init           │
└──────┬───────────────────────────────┬──────────────────┘
       │                               │
┌──────▼────────────┐       ┌──────────▼──────────────────┐
│   CV MODULE       │       │   INTELLIGENCE LAYER         │
│                   │       │                              │
│ pose_detector.py  │       │ sport_recommender.py         │
│ angle_utils.py    │       │ diet_planner.py              │
│ exercise_tracker  │       │                              │
│ body_analysis.py  │       └──────────────────────────────┘
└──────┬────────────┘
       │
┌──────▼────────────────────────────────────────────────┐
│               PERSISTENCE LAYER                        │
│   SQLite  ·  db_manager.py  ·  4 tables               │
└───────────────────────────────────────────────────────┘
```

### Data Flow

```
Webcam/Image  →  PoseDetector.detect()
                      │
                 landmarks dict { "LEFT_KNEE": [x,y,z,vis], … }
                      │
             ┌────────┴────────┐
             ▼                 ▼
    ExerciseTracker       body_analysis
    (state machine)       full_body_analysis()
             │                 │
        rep_count          BMI + body_type
        stage              shoulder_hip_ratio
        feedback                │
             │            SportRecommender
             └──────┬─────DietPlanner
                    ▼
               HUD Overlay  +  DB Log  +  UI Update
```

---

## 📁 Project Structure

```
Personalised_Sports_Assistant/
│
├── cv_module/
│   ├── __init__.py
│   ├── pose_detector.py      # MediaPipe wrapper, landmark extraction
│   ├── angle_utils.py        # calculate_angle() + named joint helpers
│   ├── exercise_tracker.py   # Squat / Pushup / JumpingJack state machines
│   └── body_analysis.py      # BMI, WHO classification, shoulder-hip ratio
│
├── recommendation/
│   ├── __init__.py
│   ├── sport_recommender.py  # Rule table: 12 BMI×body-type combos → sports
│   └── diet_planner.py       # 12 BMI×diet templates → DailyMealPlan
│
├── backend/
│   ├── __init__.py
│   ├── main.py               # FastAPI app, CORS, lifespan, uvicorn entry
│   └── routes.py             # 12 REST endpoints
│
├── database/
│   ├── __init__.py
│   └── db_manager.py         # SQLite CRUD: users, sessions, logs, snapshots
│
├── frontend/
│   └── app.py                # Streamlit 6-page dark-mode UI
│
├── utils/
│   ├── __init__.py
│   └── helpers.py            # Config, logging, frame utils, HUD renderers
│
├── config.yaml               # All thresholds, paths, model config
├── requirements.txt
└── README.md
```

---

## ⚙️ Installation

### Prerequisites
- Python 3.10 or higher
- A working webcam (for live exercise tracking)
- Windows / macOS / Linux

### Step 1 — Clone / Open the Project

```bash
cd Personalised_Sports_Assistant
```

### Step 2 — Create a Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

> **Note:** `mediapipe` requires Python ≤ 3.12 and a compatible NumPy version.
> If you see NumPy errors, run: `pip install numpy==1.26.4`

---

## 🚀 Running the System

### Option A — Streamlit UI Only (Recommended for quick demo)

The Streamlit app runs **fully standalone** — it imports all modules directly
without needing the FastAPI backend.

```bash
streamlit run frontend/app.py
```

Open [http://localhost:8501](http://localhost:8501) in your browser.

### Option B — FastAPI Backend (for API access / external integrations)

```bash
# From the project root
python -m backend.main
```

API docs available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Option C — Run Both (Full System)

Open **two terminals**:

```bash
# Terminal 1 — Backend
python -m backend.main

# Terminal 2 — Frontend
streamlit run frontend/app.py
```

---

## 🔬 Module Breakdown

### `cv_module/angle_utils.py`
Core geometric engine. `calculate_angle(A, B, C)` uses the dot-product cosine
formula to compute the interior angle at joint B:

```
angle = arccos( (BA · BC) / (|BA| × |BC|) )
```

Named helpers: `get_knee_angle()`, `get_elbow_angle()`, `get_shoulder_angle()`,
`get_torso_angle()`, `get_shoulder_width()`, `get_hip_width()`

### `cv_module/pose_detector.py`
Wraps `mp.solutions.pose.Pose`. Returns a named dict:
```python
{ "LEFT_SHOULDER": [x_px, y_px, z, visibility], ... }
```
Only includes landmarks with `visibility ≥ 0.50`. Supports both streaming
(`detect()`) and static-image (`detect_static()`) modes.

### `cv_module/exercise_tracker.py`
Three state-machine trackers sharing `_BaseTracker`:

| Tracker | Key Angles | DOWN condition | UP condition |
|---|---|---|---|
| `SquatTracker` | Knee (avg L+R) | `knee < 90°` | `knee > 160°` |
| `PushupTracker` | Elbow (avg L+R) | `elbow < 90°` | `elbow > 160°` |
| `JumpingJackTracker` | Shoulder abduction | arms down + legs together | arms up + legs spread |

Each tracker returns `ExerciseState(reps, stage, feedback, feedback_level, confidence, angles)`.

### `cv_module/body_analysis.py`
- `compute_bmi(weight_kg, height_cm)` → WHO formula
- `classify_bmi(bmi)` → Underweight / Normal / Overweight / Obese
- `analyze_body_proportions(landmarks)` → shoulder/hip ratio → body type
- `full_body_analysis(landmarks, weight, height)` → `BodyAnalysisResult`

### `recommendation/sport_recommender.py`
12-entry rule table keyed by `(bmi_category, body_type)`. Returns up to 3
`SportRecommendation` objects with sport, intensity, rationale, weekly sessions,
and duration.

### `recommendation/diet_planner.py`
12-template library keyed by `(bmi_category, dietary_preference)`.
`plan()` returns a `DailyMealPlan` with 5 meals + calorie target + protein goal
+ water intake + personalised notes.

### `database/db_manager.py`
SQLite with WAL journal and foreign keys. Tables:
- `users` — profile + latest analysis results
- `sessions` — workout sessions with duration
- `exercise_logs` — per-frame data (angles, reps, feedback)
- `progress_snapshots` — periodic BMI/weight snapshots

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/users` | Create / get user |
| GET  | `/api/users` | List all users |
| GET  | `/api/users/{id}` | User profile |
| GET  | `/api/users/{id}/summary` | Dashboard summary |
| POST | `/api/analyze-body` | BMI + body type from base64 image |
| POST | `/api/recommend-sport` | Sport recommendations |
| POST | `/api/recommend-diet` | Daily meal plan |
| POST | `/api/sessions/start` | Start workout session |
| POST | `/api/sessions/{id}/end` | End session |
| GET  | `/api/sessions/{id}` | Session details |
| GET  | `/api/sessions/{id}/logs` | Frame-level logs |
| GET  | `/api/progress/{user_id}` | Progress history |
| GET  | `/api/health` | Health check |

Full interactive docs: `http://127.0.0.1:8000/docs`

---

## 📊 Example Outputs

### Body Analysis
```json
{
  "bmi_result": { "weight_kg": 72, "height_cm": 175, "bmi": 23.51, "category": "Normal" },
  "shoulder_hip_ratio": 1.34,
  "body_type": "Lean/Athletic",
  "confidence": 0.9,
  "recommendations_hint": "Excellent base. Maintain with sport-specific training."
}
```

### Sport Recommendation
```json
[
  { "sport": "Football", "intensity": "High", "rationale": "Speed and agility suit your athletic build.", "weekly_sessions": 4, "duration_min": 90 },
  { "sport": "Basketball", "intensity": "High", "rationale": "Explosive movements match your lean physique.", "weekly_sessions": 3, "duration_min": 90 }
]
```

### Meal Plan (excerpt)
```json
{
  "breakfast": { "name": "Protein Breakfast", "items": ["2 scrambled eggs", "1 slice whole-grain toast", "1 banana"], "approx_calories": 480 },
  "total_calories": 2480,
  "protein_target_g": 108,
  "water_litres": 2.4
}
```

### Exercise State (per frame)
```json
{ "reps": 7, "stage": "DOWN", "feedback": "Good depth! Push back up.", "confidence": 1.0, "angles": { "knee": 84.3, "torso": 12.1 } }
```

---

## 🔮 Future Scope

| Feature | Description |
|---|---|
| **Posture Heatmap** | Colour-coded skeleton overlay highlighting misaligned joints |
| **ML Sport Classifier** | scikit-learn RandomForest trained on body measurements |
| **Multi-Camera** | Support for multiple camera angles for 3-D pose estimation |
| **Mobile App** | React Native / Flutter frontend using the FastAPI backend |
| **Wearable Integration** | Import heart rate data from Fitbit / Apple Health |
| **Video Upload** | Analyse pre-recorded workout videos, not just live webcam |
| **Nutritionist Mode** | Fine-grained macro tracking and meal logging |
| **Authentication** | JWT-based user auth for multi-user production deployment |

---

## 🧭 Academic Scope Notes (May 2026)

This project is intentionally scoped for an academic timeline. The current plan
focuses on a lightweight, explainable pipeline rather than heavy ML/DL across
every subsystem.

### ✅ Agreed Direction

- **Sport recommendation**: rule-based scoring or optional lightweight ML
- **Diet planning**: rule-based templates
- **Pose estimation**: use MediaPipe + joint-angle logic (no custom DL model)

The product flow remains:

user → body analysis → sport recommendation → diet → training → tracking

### 🏷️ Sport Categories (Finalized)

Each category contains three target sports. The system recommends the top 2
fit sports based on body metrics, then the user selects one to train.

1. **Fielding**: Cricket, Baseball, Softball
2. **Invasion**: Kabaddi, Football, Hockey
3. **Net**: Badminton, Tennis, Volleyball
4. **Combat**: Wrestling (Kushti/Mat), Boxing, Mixed Martial Arts (MMA)

### 🏋️ Exercise Mapping per Sport

These exercises are used for training sessions and pose tracking.

**Fielding**

| Sport | Exercise 1 | Exercise 2 | Exercise 3 | Exercise 4 | Exercise 5 |
|---|---|---|---|---|---|
| Cricket | Squats | Lateral Shuffle | High Knees | Forward Bend | Overhead Throw Motion |
| Baseball | Overhead Throw Motion | Squats | Arm Circles | Lunge | Plank |
| Softball | Lateral Shuffle | Squats | Arm Circles | High Knees | Lunge |

**Invasion**

| Sport | Exercise 1 | Exercise 2 | Exercise 3 | Exercise 4 | Exercise 5 |
|---|---|---|---|---|---|
| Kabaddi | Deep Squats | Plank | Lunges | Burpees | High Knees |
| Football | High Knees | Lunges | Squats | Lateral Shuffle | Burpees |
| Hockey | Squats | Forward Bend | Lunges | Lateral Shuffle | Plank |

**Net**

| Sport | Exercise 1 | Exercise 2 | Exercise 3 | Exercise 4 | Exercise 5 |
|---|---|---|---|---|---|
| Badminton | Jump Squats | Lateral Shuffle | High Knees | Arm Swings | Lunges |
| Tennis | Lunges | Shoulder Rotation | Arm Circles | Squats | Plank |
| Volleyball | Jump Squats | Squats | Burpees | Arm Circles | Plank |

**Combat**

| Sport | Exercise 1 | Exercise 2 | Exercise 3 | Exercise 4 | Exercise 5 |
|---|---|---|---|---|---|
| Wrestling | Squats | Push-ups | Lunges | Plank | Burpees |
| Boxing | Shadow Punch | High Knees | Jump Squats | Plank | Shoulder Rotation |
| MMA | Burpees | Push-ups | Squats | Shadow Punch | Plank |

### ✅ Pose Estimation Exercise Set

Planned exercise list for pose estimation and form checks:

1. Squat
2. Jump Squat
3. Lunge
4. Lateral Shuffle (Side Steps)
5. Push-up
6. Shadow Punch (Boxing motion)
7. Arm Circles
8. Overhead Throw Motion
9. Plank
10. Burpee
11. High Knees
12. Forward Bend
13. Shoulder Rotation

---

## 📜 License

MIT — free to use, modify, and distribute.

---

*Built with ❤️ using OpenCV, MediaPipe, FastAPI, and Streamlit.*
