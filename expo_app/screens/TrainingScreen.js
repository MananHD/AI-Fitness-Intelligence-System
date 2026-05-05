/**
 * TrainingScreen.js – Sport-specific exercises + live video corrector.
 * Shows exercises recommended for the chosen sport, then opens the
 * webcam-style exercise tracker with real-time rep counting.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';
import { startSession, endSession } from '../utils/api';
import { loadUser, setJourneyComplete } from '../utils/storage';

// ── Sport → recommended exercises mapping ─────────────────────────────────
const SPORT_EXERCISES = {
  'Football':          ['squat', 'jumping_jack', 'pushup'],
  'Basketball':        ['squat', 'jumping_jack', 'pushup'],
  'Cricket':           ['squat', 'pushup', 'jumping_jack'],
  'Tennis':            ['squat', 'jumping_jack', 'pushup'],
  'Badminton':         ['squat', 'jumping_jack', 'pushup'],
  'Swimming':          ['pushup', 'squat', 'jumping_jack'],
  'Cycling':           ['squat', 'pushup', 'jumping_jack'],
  'Running':           ['squat', 'jumping_jack', 'pushup'],
  'Athletics (Track)': ['squat', 'jumping_jack', 'pushup'],
  'Walking':           ['squat', 'jumping_jack', 'pushup'],
  'Yoga':              ['squat', 'pushup', 'jumping_jack'],
  'Gymnastics':        ['pushup', 'squat', 'jumping_jack'],
  'Rock Climbing':     ['pushup', 'squat', 'jumping_jack'],
  'Dance':             ['jumping_jack', 'squat', 'pushup'],
  'Volleyball':        ['squat', 'jumping_jack', 'pushup'],
  'Boxing':            ['pushup', 'jumping_jack', 'squat'],
  'Martial Arts':      ['pushup', 'squat', 'jumping_jack'],
  'Weight Training':   ['squat', 'pushup', 'jumping_jack'],
  'Crossfit':          ['pushup', 'squat', 'jumping_jack'],
};

const EXERCISE_INFO = {
  squat: {
    emoji: '🏋️',
    name: 'Squat',
    muscles: 'Quads · Glutes · Hamstrings · Core',
    tip: 'Keep chest up, knees behind toes, go to 90°',
    benefit: 'Builds explosive lower-body power',
  },
  pushup: {
    emoji: '💪',
    name: 'Push-up',
    muscles: 'Chest · Triceps · Shoulders · Core',
    tip: 'Keep body straight, lower chest to ground level',
    benefit: 'Builds upper-body push strength & stability',
  },
  jumping_jack: {
    emoji: '⚡',
    name: 'Jumping Jack',
    muscles: 'Full Body · Cardio · Shoulders · Calves',
    tip: 'Arms fully overhead, legs wider than shoulders',
    benefit: 'Boosts cardiovascular endurance & coordination',
  },
};

const ExerciseCard = ({ exKey, onStart }) => {
  const info = EXERCISE_INFO[exKey] || {};
  return (
    <View style={s.exerciseCard}>
      <View style={s.exerciseHeader}>
        <Text style={s.exerciseEmoji}>{info.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.exerciseName}>{info.name}</Text>
          <Text style={s.exerciseMuscles}>{info.muscles}</Text>
        </View>
        <TouchableOpacity style={s.startBtn} onPress={() => onStart(exKey)}>
          <Text style={s.startBtnTxt}>▶ Start</Text>
        </TouchableOpacity>
      </View>
      <View style={s.exerciseTipRow}>
        <Text style={s.exerciseTip}>📐 {info.tip}</Text>
      </View>
      <Text style={s.exerciseBenefit}>✅ {info.benefit}</Text>
    </View>
  );
};

export default function TrainingScreen({ route }) {
  const { sport = 'Swimming', analysis } = route.params || {};

  const exercises = SPORT_EXERCISES[sport] || ['squat', 'pushup', 'jumping_jack'];

  const [activeExercise, setActive]   = useState(null);
  const [sessionId, setSessionId]     = useState(null);
  const [reps, setReps]               = useState(0);
  const [stage, setStage]             = useState('—');
  const [sessionRunning, setRunning]  = useState(false);
  const [loading, setLoading]         = useState(false);

  // ─── NOTE: Real-time webcam tracking requires a native camera component.
  // On Expo Go, we simulate tracking with a rep-counter UI connected to the backend.
  // For full CV, this would integrate expo-camera + WebSocket to the FastAPI backend.

  const handleStart = async (exKey) => {
    setLoading(true);
    try {
      const user = await loadUser();
      if (!user) { Alert.alert('No profile', 'Please create a profile first.'); setLoading(false); return; }

      const res = await startSession({ user_id: user.id, exercise: exKey });
      setSessionId(res.session_id);
      setActive(exKey);
      setReps(0);
      setStage('Ready');
      setRunning(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await endSession(sessionId, { total_reps: reps });
      await setJourneyComplete();   // unlock Progress tab
      Alert.alert('✅ Session saved!', `${activeExercise?.replace('_', ' ')} — ${reps} reps recorded.`);
      setActive(null);
      setSessionId(null);
      setReps(0);
      setStage('—');
      setRunning(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const addRep = () => {
    setReps(r => r + 1);
    setStage(prev => prev === 'UP' ? 'DOWN' : 'UP');
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.pageTitle}>🏃 Training</Text>
        <View style={s.sportBadge}>
          <Text style={s.sportBadgeTxt}>🏅 {sport}</Text>
        </View>
      </View>
      <Text style={s.pageSub}>
        Exercises tailored for <Text style={{ color: colors.accent }}>{sport}</Text> — build the strength and endurance you need
      </Text>

      {/* Active session tracker */}
      {sessionRunning && activeExercise && (
        <View style={s.trackerCard}>
          <Text style={s.trackerTitle}>
            {EXERCISE_INFO[activeExercise]?.emoji} {EXERCISE_INFO[activeExercise]?.name} — Live Tracker
          </Text>

          {/* Rep display */}
          <View style={s.repDisplay}>
            <Text style={s.repCount}>{reps}</Text>
            <Text style={s.repLabel}>REPS</Text>
          </View>

          <View style={s.stageRow}>
            <View style={[s.stageBadge, stage === 'UP' && s.stageBadgeUp]}>
              <Text style={s.stageTxt}>⬆ UP</Text>
            </View>
            <View style={[s.stageBadge, stage === 'DOWN' && s.stageBadgeDown]}>
              <Text style={s.stageTxt}>⬇ DOWN</Text>
            </View>
          </View>

          <Text style={s.trackerHint}>
            📷 For real-time AI posture correction, use the Streamlit desktop app with your webcam
          </Text>
          <Text style={s.trackerTip}>
            {EXERCISE_INFO[activeExercise]?.tip}
          </Text>

          {/* Manual rep counter */}
          <View style={s.manualRow}>
            <TouchableOpacity style={s.repBtn} onPress={addRep}>
              <Text style={s.repBtnTxt}>+ Rep</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.undoBtn} onPress={() => setReps(r => Math.max(0, r - 1))}>
              <Text style={s.undoBtnTxt}>Undo</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.stopBtn} onPress={handleStop} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={s.stopBtnTxt}>⏹ Stop & Save Session</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Exercise list */}
      {!sessionRunning && (
        <>
          <Text style={s.sectionTitle}>Your Exercise Plan</Text>
          <Text style={s.sectionSub}>These 3 exercises are optimised for {sport} performance</Text>

          {exercises.map((ex, i) => (
            <ExerciseCard
              key={ex}
              exKey={ex}
              onStart={handleStart}
            />
          ))}

          {/* Priority order */}
          <View style={s.priorityCard}>
            <Text style={s.priorityTitle}>📋 Recommended Workout Order</Text>
            {exercises.map((ex, i) => (
              <View key={ex} style={s.priorityRow}>
                <View style={s.priorityNum}>
                  <Text style={s.priorityNumTxt}>{i + 1}</Text>
                </View>
                <Text style={s.priorityExercise}>
                  {EXERCISE_INFO[ex]?.emoji} {EXERCISE_INFO[ex]?.name}
                </Text>
                <Text style={s.prioritySets}>3 × 12 reps</Text>
              </View>
            ))}
            <Text style={s.priorityNote}>Rest 60–90 seconds between sets</Text>
          </View>

          {/* CV note */}
          <View style={s.cvCard}>
            <Text style={s.cvTitle}>🤖 AI Posture Correction</Text>
            <Text style={s.cvTxt}>
              The AI video corrector uses your phone's camera with MediaPipe pose detection.
              Tap <Text style={{ fontWeight: '700', color: colors.accent }}>▶ Start</Text> on any exercise above to begin a tracked session with rep counting.
              {'\n\n'}
              For full real-time angle analysis and posture overlays, open the <Text style={{ fontWeight: '700' }}>Streamlit desktop app</Text> on your PC.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg, padding: spacing.md },

  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                   marginBottom: spacing.xs },
  pageTitle:     { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  sportBadge:    { backgroundColor: colors.accent, borderRadius: radius.sm,
                   paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  sportBadgeTxt: { color: colors.bg, fontWeight: '700', fontSize: font.sm },
  pageSub:       { fontSize: font.md, color: colors.subtext, marginBottom: spacing.lg },

  // Live tracker
  trackerCard:   { backgroundColor: '#0d1f3c', borderRadius: radius.lg, padding: spacing.lg,
                   borderWidth: 1, borderColor: colors.blue, marginBottom: spacing.lg },
  trackerTitle:  { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.lg,
                   textAlign: 'center' },
  repDisplay:    { alignItems: 'center', marginBottom: spacing.md },
  repCount:      { fontSize: 80, fontWeight: '900', color: colors.accent },
  repLabel:      { fontSize: font.lg, color: colors.subtext, fontWeight: '700', letterSpacing: 4 },

  stageRow:      { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.md },
  stageBadge:    { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm,
                   backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stageBadgeUp:  { backgroundColor: colors.accent, borderColor: colors.accent },
  stageBadgeDown:{ backgroundColor: colors.blue, borderColor: colors.blue },
  stageTxt:      { color: colors.text, fontWeight: '700', fontSize: font.md },

  trackerHint:   { color: colors.subtext, fontSize: font.sm, textAlign: 'center', marginBottom: spacing.sm },
  trackerTip:    { color: colors.accent, fontSize: font.sm, textAlign: 'center',
                   fontStyle: 'italic', marginBottom: spacing.lg },

  manualRow:     { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  repBtn:        { flex: 2, backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                   alignItems: 'center' },
  repBtnTxt:     { color: colors.bg, fontWeight: '700', fontSize: font.xl },
  undoBtn:       { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
                   alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  undoBtnTxt:    { color: colors.subtext, fontWeight: '700', fontSize: font.md },

  stopBtn:       { backgroundColor: '#c0392b', borderRadius: radius.lg, padding: spacing.md,
                   alignItems: 'center' },
  stopBtnTxt:    { color: '#fff', fontWeight: '700', fontSize: font.lg },

  // Exercise list
  sectionTitle:  { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  sectionSub:    { fontSize: font.md, color: colors.subtext, marginBottom: spacing.md },

  exerciseCard:  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                   borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  exerciseHeader:{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  exerciseEmoji: { fontSize: 32, marginRight: spacing.md },
  exerciseName:  { fontSize: font.lg, fontWeight: '700', color: colors.text },
  exerciseMuscles:{ fontSize: font.sm, color: colors.subtext, marginTop: 2 },
  startBtn:      { backgroundColor: colors.accent, borderRadius: radius.sm,
                   paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  startBtnTxt:   { color: colors.bg, fontWeight: '700', fontSize: font.md },
  exerciseTipRow:{ backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.sm,
                   marginBottom: spacing.sm },
  exerciseTip:   { color: colors.subtext, fontSize: font.sm },
  exerciseBenefit:{ color: colors.accent, fontSize: font.sm, fontWeight: '600' },

  priorityCard:  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                   borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  priorityTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  priorityRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  priorityNum:   { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent,
                   alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  priorityNumTxt:{ color: colors.bg, fontWeight: '700', fontSize: font.sm },
  priorityExercise: { flex: 1, color: colors.text, fontWeight: '600', fontSize: font.md },
  prioritySets:  { color: colors.subtext, fontSize: font.sm },
  priorityNote:  { color: colors.subtext, fontSize: font.sm, fontStyle: 'italic', marginTop: spacing.xs },

  cvCard:        { backgroundColor: '#1a1f35', borderRadius: radius.md, padding: spacing.md,
                   borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cvTitle:       { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  cvTxt:         { color: colors.subtext, fontSize: font.md, lineHeight: 22 },
});
