"""
app.py – Streamlit multi-page frontend for the AI Fitness Intelligence System.

Pages:
  🏠 Home            – Welcome + quick start guide
  👤 Profile         – Create / select user
  📸 Body Analysis   – Upload image + metadata → BMI + body type + sport recs
  🏃 Live Exercise   – Webcam rep counter with real-time feedback
  🥗 Diet Plan       – Personalised meal plan viewer
  📊 Progress        – BMI / weight / reps charts over time
"""

from __future__ import annotations

import base64
import io
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import requests
import streamlit as st
from PIL import Image

# ── Make sure project root is on sys.path ─────────────────────────────────────
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from cv_module.body_analysis import full_body_analysis
from cv_module.exercise_tracker import get_tracker, TRACKER_MAP
from cv_module.pose_detector import PoseDetector
from database.db_manager import DatabaseManager
from recommendation.diet_planner import DietPlanner
from recommendation.weekly_diet import generate_weekly_plan, DAYS
from recommendation.sport_recommender import SportRecommender
from utils.helpers import draw_overlay, draw_feedback_bar, draw_rep_counter, encode_frame_base64

# ── Constants ─────────────────────────────────────────────────────────────────
_CFG = load_config().get("api", {})
API_BASE = f"http://{_CFG.get('host', '127.0.0.1')}:{_CFG.get('port', 8000)}/api"
DB = DatabaseManager()
DB.init_db()
SPORT_REC = SportRecommender()
DIET_PLAN = DietPlanner()

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AI Fitness Intelligence",
    page_icon="🏋️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

.main { background: #0f1117; }

.metric-card {
    background: linear-gradient(135deg, #1e2130 0%, #252840 100%);
    border: 1px solid #2d3150;
    border-radius: 12px;
    padding: 20px 24px;
    margin: 8px 0;
}
.metric-value { font-size: 2rem; font-weight: 700; color: #00e676; }
.metric-label { font-size: 0.85rem; color: #8892b0; margin-top: 4px; }

.sport-card {
    background: linear-gradient(135deg, #1a1f35 0%, #1e2540 100%);
    border: 1px solid #2d3a6e;
    border-left: 4px solid #4f8ef7;
    border-radius: 10px;
    padding: 16px 20px;
    margin: 8px 0;
}
.sport-name { font-size: 1.1rem; font-weight: 600; color: #e2e8f0; }
.sport-intensity { font-size: 0.8rem; padding: 2px 10px; border-radius: 20px;
    background: #1e3a5f; color: #63b3ed; display: inline-block; margin: 4px 0; }
.sport-rationale { font-size: 0.85rem; color: #94a3b8; }

.meal-card {
    background: #1a1f35;
    border: 1px solid #2d3150;
    border-radius: 10px;
    padding: 14px 18px;
    margin: 6px 0;
}
.meal-name { font-weight: 600; color: #f0fff4; }
.meal-cal  { color: #48bb78; font-size: 0.85rem; }

.section-header {
    font-size: 1.4rem; font-weight: 700;
    color: #e2e8f0; margin: 24px 0 12px;
    border-bottom: 2px solid #2d3150;
    padding-bottom: 8px;
}
.feedback-ok   { color: #48bb78; font-weight: 600; }
.feedback-warn { color: #f6e05e; font-weight: 600; }
.feedback-err  { color: #fc8181; font-weight: 600; }

div[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #0d1117 0%, #161b2e 100%);
    border-right: 1px solid #2d3150;
}
</style>
""", unsafe_allow_html=True)


# ── Session State Defaults ────────────────────────────────────────────────────
def _init_state():
    defaults = {
        "user_id":      None,
        "username":     None,
        "user_data":    None,
        "session_id":   None,
        "tracker":      None,
        "exercise":     "squat",
        "chosen_sport": None,
        "last_analysis": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

_init_state()


# ── Sidebar Navigation ────────────────────────────────────────────────────────
ALL_SPORTS = [
    'Football','Basketball','Cricket','Tennis','Badminton','Swimming','Cycling',
    'Running','Athletics (Track)','Walking','Yoga','Gymnastics','Rock Climbing',
    'Dance','Volleyball','Boxing','Martial Arts','Weight Training','Crossfit',
    'Pilates','Surfing','Rowing','Table Tennis','Golf','Hiking','Squash',
    'Water Aerobics','Chair Yoga',
]

SPORT_EXERCISES = {
    'Football':['squat','jumping_jack','pushup'],'Basketball':['squat','jumping_jack','pushup'],
    'Swimming':['pushup','squat','jumping_jack'],'Cycling':['squat','pushup','jumping_jack'],
    'Running':['squat','jumping_jack','pushup'],'Yoga':['squat','pushup','jumping_jack'],
    'Gymnastics':['pushup','squat','jumping_jack'],'Rock Climbing':['pushup','squat','jumping_jack'],
    'Dance':['jumping_jack','squat','pushup'],'Boxing':['pushup','jumping_jack','squat'],
    'Martial Arts':['pushup','squat','jumping_jack'],'Weight Training':['squat','pushup','jumping_jack'],
    'Crossfit':['pushup','squat','jumping_jack'],
}

with st.sidebar:
    st.markdown("## 🏋️ AI Fitness")
    st.markdown("---")
    page = st.radio(
        "Navigate",
        ["👤 Profile", "📸 Body Analysis", "🥗 Diet Plan", "🏃 Training", "📊 Progress"],
        label_visibility="collapsed",
    )
    st.markdown("---")
    if st.session_state.username:
        st.success(f"👤 {st.session_state.username}")
    else:
        st.info("⚠️ No profile — start here")
    if st.session_state.chosen_sport:
        st.info(f"🏅 Sport: {st.session_state.chosen_sport}")
    st.markdown("---")
    st.caption("AI Fitness Intelligence v1.0")


# ════════════════════════════════════════════════════════════════════════════════
# PAGE: PROFILE (landing page)
# ════════════════════════════════════════════════════════════════════════════════
if page == "👤 Profile":
    st.markdown("# 👤 User Profile")
    st.markdown("---")

    tab1, tab2 = st.tabs(["Create / Select Profile", "All Users"])

    with tab1:
        with st.form("profile_form"):
            username  = st.text_input("Username *", placeholder="e.g. alice_fit")
            col1, col2 = st.columns(2)
            with col1:
                age       = st.number_input("Age", min_value=5, max_value=100, value=25)
                height_cm = st.number_input("Height (cm)", min_value=100.0, max_value=250.0, value=170.0, step=0.5)
            with col2:
                weight_kg = st.number_input("Weight (kg)", min_value=20.0, max_value=300.0, value=70.0, step=0.5)
                diet_pref = st.selectbox("Dietary Preference", ["veg", "non-veg", "vegan"])

            submitted = st.form_submit_button("💾 Save Profile", use_container_width=True)

        if submitted and username:
            user = DB.get_or_create_user(
                username,
                age=int(age),
                height_cm=float(height_cm),
                weight_kg=float(weight_kg),
                diet_pref=diet_pref,
            )
            st.session_state.user_id   = user["id"]
            st.session_state.username  = user["username"]
            st.session_state.user_data = user
            st.success(f"✅ Profile ready for **{username}**!")

    with tab2:
        users = DB.list_users()
        if users:
            df = pd.DataFrame(users)[["id","username","age","height_cm","weight_kg","bmi","bmi_category","diet_pref"]]
            st.dataframe(df, use_container_width=True)

            sel = st.selectbox("Switch to user", [u["username"] for u in users])
            if st.button("Select User"):
                user = DB.get_user_by_username(sel)
                st.session_state.user_id   = user["id"]
                st.session_state.username  = user["username"]
                st.session_state.user_data = user
                st.success(f"Switched to **{sel}**")
        else:
            st.info("No users yet. Create one above.")


# ════════════════════════════════════════════════════════════════════════════════
# PAGE: BODY ANALYSIS
# ════════════════════════════════════════════════════════════════════════════════
elif page == "📸 Body Analysis":
    st.markdown("# 📸 Body Analysis")
    st.markdown("Upload a **full-body photo** to analyse your BMI and body proportions.")
    st.markdown("---")

    if not st.session_state.user_id:
        st.warning("⚠️ Please create / select a profile first.")
        st.stop()

    user_data = DB.get_user(st.session_state.user_id) or {}
    col1, col2 = st.columns([1, 1])

    with col1:
        uploaded = st.file_uploader("Upload full-body image", type=["jpg","jpeg","png"])
        weight_kg = st.number_input("Weight (kg)", value=float(user_data.get("weight_kg") or 70), step=0.5)
        height_cm = st.number_input("Height (cm)", value=float(user_data.get("height_cm") or 170), step=0.5)
        analyse_btn = st.button("🔍 Analyse Body", use_container_width=True)

    with col2:
        if uploaded:
            img = Image.open(uploaded).convert("RGB")
            st.image(img, caption="Uploaded Image", use_container_width=True)

    if analyse_btn and uploaded:
        with st.spinner("Running pose detection …"):
            img_arr = np.array(Image.open(uploaded).convert("RGB"))
            bgr = cv2.cvtColor(img_arr, cv2.COLOR_RGB2BGR)

            detector = PoseDetector(static_image_mode=True)
            landmarks, annotated = detector.detect_static(bgr)
            detector.close()

            result = full_body_analysis(landmarks, weight_kg, height_cm)
            bmi_r  = result.bmi_result

            DB.update_user_analysis(
                st.session_state.user_id,
                weight_kg, bmi_r.bmi, bmi_r.category, result.body_type,
            )
            DB.save_progress_snapshot(
                st.session_state.user_id,
                weight_kg, bmi_r.bmi, bmi_r.category,
            )

        st.markdown("---")
        st.markdown("### 📊 Analysis Results")

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("BMI", f"{bmi_r.bmi:.1f}")
        c2.metric("Category", bmi_r.category)
        c3.metric("Body Type", result.body_type)
        c4.metric("Confidence", f"{result.confidence*100:.0f}%")

        if result.shoulder_hip_ratio:
            st.metric("Shoulder/Hip Ratio", f"{result.shoulder_hip_ratio:.2f}")

        st.info(f"💡 {result.recommendations_hint}")

        if landmarks:
            annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
            st.image(annotated_rgb, caption="Pose Landmarks Detected", use_container_width=True)
        else:
            st.warning("No pose detected in image. Ensure a clear full-body photo.")

        # Sport recommendations
        st.markdown("---")
        st.markdown("### 🏃 Sport Recommendations")
        sports = SPORT_REC.recommend(bmi_r.category, result.body_type)
        for s in sports:
            st.markdown(f"""<div class="sport-card">
                <div class="sport-name">🏅 {s.sport}</div>
                <div class="sport-intensity">{s.intensity} intensity</div>
                <div class="sport-rationale">{s.rationale}</div>
                <small style="color:#64748b;">📅 {s.weekly_sessions}×/week · ⏱ {s.duration_min} min/session</small>
            </div>""", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════════════════
# PAGE: LIVE EXERCISE
# ════════════════════════════════════════════════════════════════════════════════
elif page == "🏃 Training":
    st.markdown("# 🏃 Live Exercise Tracker")
    st.markdown("Real-time rep counting with posture feedback via your webcam.")
    st.markdown("---")

    if not st.session_state.user_id:
        st.warning("⚠️ Please create / select a profile first.")
        st.stop()

    col_ctrl, col_vid = st.columns([1, 2])

    with col_ctrl:
        exercise = st.selectbox(
            "Exercise", list(TRACKER_MAP.keys()),
            format_func=lambda x: x.replace("_", " ").title(),
        )
        start_btn = st.button("▶ Start Session", use_container_width=True)
        stop_btn  = st.button("⏹ Stop Session",  use_container_width=True)

        st.markdown("---")
        st.markdown("**How to use:**")
        st.markdown("""
- Click **Start Session**
- Stand in front of your webcam
- Perform reps — the counter updates live
- Click **Stop Session** when done
        """)

        rep_placeholder    = st.empty()
        stage_placeholder  = st.empty()
        feed_placeholder   = st.empty()

    with col_vid:
        frame_placeholder = st.empty()

    # ── Session logic ─────────────────────────────────────────────────────────
    if start_btn:
        tracker = get_tracker(exercise)
        st.session_state.tracker  = tracker
        st.session_state.exercise = exercise
        sid = DB.start_session(st.session_state.user_id, exercise)
        st.session_state.session_id = sid
        st.success(f"Session #{sid} started!")

    if stop_btn and st.session_state.session_id:
        tracker = st.session_state.tracker
        reps = tracker.reps if tracker else 0
        DB.end_session(st.session_state.session_id, reps)
        st.success(f"Session ended. Total reps: **{reps}**")
        st.session_state.session_id = None
        st.session_state.tracker = None

    # ── Live webcam loop ──────────────────────────────────────────────────────
    if st.session_state.session_id and st.session_state.tracker:
        detector = PoseDetector()
        cap      = cv2.VideoCapture(0)

        if not cap.isOpened():
            st.error("❌ Cannot open webcam. Please check camera permissions.")
            st.stop()

        tracker = st.session_state.tracker

        try:
            while st.session_state.session_id:
                ret, frame = cap.read()
                if not ret:
                    break

                frame = cv2.resize(frame, (640, 480))
                landmarks, annotated = detector.detect(frame)

                if landmarks:
                    state = tracker.update(landmarks)

                    annotated = draw_rep_counter(annotated, state.reps, state.stage, exercise)
                    stats = {"Reps": state.reps, "Stage": state.stage, "Conf": f"{state.confidence:.0%}"}
                    annotated = draw_overlay(annotated, stats)

                    color = {"info": "green", "warning": "yellow", "error": "red"}.get(
                        state.feedback_level, "yellow"
                    )
                    annotated = draw_feedback_bar(annotated, state.feedback, color)

                    rep_placeholder.metric("Reps", state.reps)
                    stage_placeholder.metric("Stage", state.stage)
                    feed_cls = {"info": "feedback-ok", "warning": "feedback-warn", "error": "feedback-err"}.get(
                        state.feedback_level, "feedback-ok"
                    )
                    feed_placeholder.markdown(
                        f'<p class="{feed_cls}">{state.feedback}</p>', unsafe_allow_html=True
                    )

                    DB.log_exercise_frame(
                        st.session_state.session_id,
                        state.reps, state.stage, state.feedback, state.confidence,
                        knee_angle=state.angles.get("knee"),
                        elbow_angle=state.angles.get("elbow"),
                        torso_angle=state.angles.get("torso"),
                    )
                else:
                    annotated = draw_feedback_bar(annotated, "No pose detected – step back", "yellow")

                rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
                frame_placeholder.image(rgb, channels="RGB", use_container_width=True)

        finally:
            cap.release()
            detector.close()


# ════════════════════════════════════════════════════════════════════════════════
# PAGE: DIET PLAN
# ════════════════════════════════════════════════════════════════════════════════
elif page == "🥗 Diet Plan":
    st.markdown("# 🥗 Personalised Weekly Diet Plan")
    st.markdown("A unique meal plan for **each day of the week** — no repetition.")
    st.markdown("---")

    if not st.session_state.user_id:
        st.warning("⚠️ Please create / select a profile first.")
        st.stop()

    user_data = DB.get_user(st.session_state.user_id) or {}

    with st.form("diet_form"):
        col1, col2 = st.columns(2)
        with col1:
            bmi_cat = st.selectbox("BMI Category",
                ["Underweight", "Normal", "Overweight", "Obese"],
                index=["Underweight","Normal","Overweight","Obese"].index(
                    user_data.get("bmi_category") or "Normal"
                ))
            sport    = st.text_input("Recommended Sport", value="Swimming")
            intensity = st.selectbox("Sport Intensity", ["Low", "Moderate", "High"], index=1)
        with col2:
            diet_pref = st.selectbox("Dietary Preference",
                ["veg", "non-veg", "vegan"],
                index=["veg","non-veg","vegan"].index(
                    user_data.get("diet_pref") or "veg"
                ))
            weight_kg = st.number_input("Weight (kg)",
                value=float(user_data.get("weight_kg") or 70), step=0.5)
        generate = st.form_submit_button("🍽️ Generate 7-Day Meal Plan", use_container_width=True)

    if generate:
        with st.spinner("Building your personalised 7-day meal plan …"):
            weekly = generate_weekly_plan(bmi_cat, sport, intensity, diet_pref, weight_kg)

        # ── Summary bar ───────────────────────────────────────────────────────
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Daily Calories",  f"{weekly.avg_daily_calories} kcal")
        c2.metric("Protein Target",  f"{weekly.protein_target_g} g/day")
        c3.metric("Water Target",    f"{weekly.water_litres} L/day")
        c4.metric("Plan Duration",   "7 Days")

        st.markdown("---")

        # ── Day tabs ──────────────────────────────────────────────────────────
        day_emojis = ["🌙 Mon", "🌿 Tue", "🔥 Wed", "💪 Thu", "🎯 Fri", "🏖 Sat", "☀️ Sun"]
        tabs = st.tabs(day_emojis)

        meal_slots = [
            ("🌅 Breakfast",         "breakfast"),
            ("🍎 Mid-Morning Snack",  "mid_morning_snack"),
            ("🌞 Lunch",             "lunch"),
            ("🍊 Evening Snack",     "evening_snack"),
            ("🌙 Dinner",            "dinner"),
        ]

        for tab, day in zip(tabs, DAYS):
            day_plan = weekly.days[day]
            with tab:
                st.markdown(f"### 📅 {day}")
                day_total = sum(
                    getattr(day_plan, slot).approx_calories
                    for _, slot in meal_slots
                )
                st.caption(f"Estimated total: **{day_total} kcal**")

                for label, slot in meal_slots:
                    meal = getattr(day_plan, slot)
                    with st.expander(
                        f"{label}  —  {meal.name}  ({meal.approx_calories} kcal)",
                        expanded=(slot == "breakfast"),
                    ):
                        for item in meal.items:
                            st.markdown(f"• {item}")

        # ── Weekly notes ──────────────────────────────────────────────────────
        st.markdown("---")
        st.markdown("### 📋 Weekly Guidelines")
        for note in weekly.weekly_notes:
            st.markdown(f"ℹ️ {note}")


# ════════════════════════════════════════════════════════════════════════════════
# PAGE: PROGRESS
# ════════════════════════════════════════════════════════════════════════════════
elif page == "📊 Progress":
    st.markdown("# 📊 Progress Tracker")
    st.markdown("---")

    if not st.session_state.user_id:
        st.warning("⚠️ Please create / select a profile first.")
        st.stop()

    uid     = st.session_state.user_id
    summary = DB.get_user_summary(uid)
    history = DB.get_progress_history(uid, limit=30)
    sessions = DB.get_sessions_for_user(uid, limit=20)

    # ── Summary metrics ───────────────────────────────────────────────────────
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Reps",      summary.get("total_reps", 0))
    c2.metric("Total Sessions",  summary.get("total_sessions", 0))
    dur = summary.get("total_duration_s", 0)
    c3.metric("Total Time",      f"{dur//60} min")
    user = summary.get("user", {})
    c4.metric("Current BMI",     f"{user.get('bmi') or '—'}")

    st.markdown("---")

    if not history:
        st.info("No progress data yet. Complete a Body Analysis to start tracking.")
    else:
        df_prog = pd.DataFrame(history)
        df_prog["recorded_at"] = pd.to_datetime(df_prog["recorded_at"])
        df_prog = df_prog.sort_values("recorded_at")

        tab1, tab2, tab3 = st.tabs(["BMI History", "Weight History", "Session History"])

        with tab1:
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=df_prog["recorded_at"], y=df_prog["bmi"],
                mode="lines+markers", name="BMI",
                line=dict(color="#00e676", width=2),
                marker=dict(size=6),
            ))
            fig.add_hline(y=18.5, line_dash="dash", line_color="#4fc3f7", annotation_text="Underweight")
            fig.add_hline(y=24.9, line_dash="dash", line_color="#81c784", annotation_text="Normal")
            fig.add_hline(y=29.9, line_dash="dash", line_color="#ffb74d", annotation_text="Overweight")
            fig.update_layout(
                title="BMI Over Time", template="plotly_dark",
                height=350, margin=dict(l=40,r=20,t=40,b=40),
            )
            st.plotly_chart(fig, use_container_width=True)

        with tab2:
            fig2 = go.Figure()
            fig2.add_trace(go.Scatter(
                x=df_prog["recorded_at"], y=df_prog["weight_kg"],
                mode="lines+markers", name="Weight (kg)",
                line=dict(color="#4f8ef7", width=2),
            ))
            fig2.update_layout(
                title="Weight Over Time (kg)", template="plotly_dark",
                height=350, margin=dict(l=40,r=20,t=40,b=40),
            )
            st.plotly_chart(fig2, use_container_width=True)

        with tab3:
            if sessions:
                df_sess = pd.DataFrame(sessions)
                df_sess["started_at"] = pd.to_datetime(df_sess["started_at"])

                fig3 = px.bar(
                    df_sess, x="started_at", y="total_reps", color="exercise",
                    title="Reps per Session",
                    template="plotly_dark", height=350,
                )
                st.plotly_chart(fig3, use_container_width=True)

                st.dataframe(
                    df_sess[["id","exercise","started_at","total_reps","duration_s"]],
                    use_container_width=True,
                )
            else:
                st.info("No workout sessions recorded yet.")
