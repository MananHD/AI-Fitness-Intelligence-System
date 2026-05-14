/**
 * ExerciseDetailScreen.js – Pre-exercise instructions with animated demo.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';
import { startSession } from '../utils/api';
import { loadUser } from '../utils/storage';
import { EXERCISE_INFO, DIFFICULTY_COLORS } from '../utils/exerciseData';
import ExerciseDemoAnimation from '../components/ExerciseDemoAnimation';

export default function ExerciseDetailScreen({ route, navigation }) {
  const { exerciseKey, sport, analysis } = route.params || {};
  const info = EXERCISE_INFO[exerciseKey];
  const [loading, setLoading] = useState(false);

  if (!info) {
    return (
      <View style={s.container}>
        <Text style={s.errorTxt}>Exercise not found: {exerciseKey}</Text>
      </View>
    );
  }

  const diffColor = DIFFICULTY_COLORS[info.difficulty] || colors.subtext;

  const handleStartSession = async () => {
    setLoading(true);
    try {
      const user = await loadUser();
      if (!user) {
        Alert.alert('No profile', 'Please create a profile first.');
        setLoading(false);
        return;
      }

      const res = await startSession({ user_id: user.id, exercise: exerciseKey });

      navigation.navigate('ExerciseMonitor', {
        exerciseKey,
        sessionId: res.session_id,
        sport,
        analysis,
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>

      {/* Hero — Animated Demo */}
      <View style={s.heroSection}>
        <View style={[s.demoBg, { borderColor: info.color || colors.accent }]}>
          <ExerciseDemoAnimation
            exerciseKey={exerciseKey}
            color={info.color || colors.accent}
            size={1.2}
          />
        </View>
        <Text style={s.heroName}>{info.name}</Text>
        <View style={s.heroRow}>
          <View style={[s.heroBadge, { borderColor: diffColor }]}>
            <Text style={[s.heroBadgeTxt, { color: diffColor }]}>{info.difficulty}</Text>
          </View>
          <View style={[s.heroBadge, { borderColor: info.color || colors.accent }]}>
            <Text style={[s.heroBadgeTxt, { color: info.color || colors.accent }]}>
              {info.type === 'timer' ? 'Timer' : 'Reps'}
            </Text>
          </View>
        </View>
      </View>

      {/* Target */}
      <View style={s.targetCard}>
        <Text style={s.targetLabel}>TARGET</Text>
        <Text style={[s.targetVal, { color: info.color || colors.accent }]}>
          {info.type === 'timer'
            ? `${info.target_duration} seconds hold`
            : `3 sets x ${info.target_reps} reps`}
        </Text>
      </View>

      {/* Muscles */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Target Muscles</Text>
        <View style={s.muscleRow}>
          {info.muscles.split(' · ').map((m, i) => (
            <View key={i} style={[s.muscleChip, { borderColor: info.color || colors.accent }]}>
              <Text style={[s.muscleChipTxt, { color: info.color || colors.accent }]}>{m}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Instructions */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>How To Perform</Text>
        <View style={s.instructionCard}>
          {info.instructions.split('. ').filter(Boolean).map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={[s.stepNum, { backgroundColor: info.color || colors.accent }]}>
                <Text style={s.stepNumTxt}>{i + 1}</Text>
              </View>
              <Text style={s.stepTxt}>{step.trim().replace(/\.$/, '')}.</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Benefit */}
      <View style={s.benefitCard}>
        <Text style={s.benefitLabel}>WHY THIS EXERCISE</Text>
        <Text style={[s.benefitTxt, { color: info.color || colors.accent }]}>
          {info.benefit}
        </Text>
      </View>

      {/* AI Monitoring Info */}
      <View style={s.aiCard}>
        <Text style={s.aiTitle}>AI Monitoring</Text>
        <Text style={s.aiTxt}>
          When you start, the camera records a short video clip, sends it to the analyzer, and then{' '}
          {info.type === 'timer' ? 'measures your hold duration' : 'counts your reps automatically'}.{' '}
          You will get feedback after the clip is processed.
        </Text>
      </View>

      {/* Common Mistakes */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Common Mistakes</Text>
        <View style={s.mistakeCard}>
          {_getMistakes(exerciseKey).map((m, i) => (
            <View key={i} style={s.mistakeRow}>
              <View style={s.mistakeBullet} />
              <Text style={s.mistakeTxt}>{m}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Start Button */}
      <TouchableOpacity
        style={[s.startBtn, { backgroundColor: info.color || colors.accent }, loading && { opacity: 0.5 }]}
        onPress={handleStartSession}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.startBtnTxt}>Start {info.name}</Text>
        }
      </TouchableOpacity>

      <Text style={s.hintTxt}>
        Position your phone so your full body is visible in the camera
      </Text>
    </ScrollView>
  );
}

function _getMistakes(key) {
  const mistakes = {
    squat:              ['Knees caving inward', 'Heels lifting off ground', 'Back rounding forward'],
    pushup:             ['Hips sagging down', 'Elbows flaring out too wide', 'Not going low enough'],
    lunge:              ['Front knee going past toes', 'Torso leaning forward', 'Back knee not dropping low enough'],
    plank:              ['Hips sagging or piking', 'Holding breath', 'Head dropping down'],
    burpee:             ['Skipping the push-up', 'Not fully standing up', 'Landing with straight legs'],
    jump_squat:         ['Not squatting deep enough', 'Landing on straight legs', 'Knees collapsing inward'],
    overhead_throw:     ['Not following through', 'Elbow not extending fully', 'No hip rotation'],
    deep_squat:         ['Heels coming off ground', 'Knees caving in', 'Rounding the back'],
    high_knees:         ['Knees not reaching hip level', 'Leaning back too far', 'Slow tempo'],
    lateral_shuffle:    ['Standing too upright', 'Crossing feet', 'Not staying low'],
    arm_circles:        ['Bending elbows', 'Circles too small', 'Moving from the wrists not shoulders'],
    shoulder_rotation:  ['Using momentum not control', 'Not full range of motion', 'Shrugging shoulders up'],
    forward_bend:       ['Bending knees excessively', 'Rounding the back', 'Bouncing at the bottom'],
  };
  return mistakes[key] || ['Maintain proper form', 'Control your movement', 'Breathe steadily'];
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  errorTxt:      { color: colors.red, fontSize: font.lg, textAlign: 'center', marginTop: 80 },

  // Hero with demo animation
  heroSection:   { alignItems: 'center', paddingVertical: spacing.lg },
  demoBg:        { width: 160, height: 200, borderRadius: radius.lg, backgroundColor: colors.surface,
                   borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroName:      { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  heroRow:       { flexDirection: 'row', gap: spacing.sm },
  heroBadge:     { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  heroBadgeTxt:  { fontSize: font.sm, fontWeight: '700' },

  // Target
  targetCard:    { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg,
                   borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, alignItems: 'center' },
  targetLabel:   { fontSize: font.xs, color: colors.subtext, fontWeight: '700', marginBottom: spacing.xs,
                   letterSpacing: 1 },
  targetVal:     { fontSize: font.xxl, fontWeight: '800' },

  // Section
  section:       { marginBottom: spacing.lg },
  sectionTitle:  { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  // Muscles
  muscleRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  muscleChip:    { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md,
                   paddingVertical: spacing.xs },
  muscleChipTxt: { fontSize: font.sm, fontWeight: '600' },

  // Instructions
  instructionCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                     borderWidth: 1, borderColor: colors.border },
  stepRow:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  stepNum:       { width: 24, height: 24, borderRadius: 12,
                   alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, marginTop: 2 },
  stepNumTxt:    { color: '#fff', fontWeight: '700', fontSize: font.sm },
  stepTxt:       { flex: 1, color: colors.text, fontSize: font.md, lineHeight: 22 },

  // Benefit
  benefitCard:   { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                   borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  benefitLabel:  { fontSize: font.xs, color: colors.subtext, fontWeight: '700', marginBottom: spacing.xs,
                   letterSpacing: 1 },
  benefitTxt:    { fontSize: font.lg, fontWeight: '700' },

  // AI Card
  aiCard:        { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                   borderWidth: 1, borderColor: colors.accent, marginBottom: spacing.lg },
  aiTitle:       { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  aiTxt:         { color: colors.subtext, fontSize: font.md, lineHeight: 22 },

  // Mistakes
  mistakeCard:   { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                   borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  mistakeRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  mistakeBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red, marginRight: spacing.sm },
  mistakeTxt:    { color: colors.red, fontSize: font.md, flex: 1 },

  // Start
  startBtn:      { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  startBtnTxt:   { color: '#fff', fontWeight: '800', fontSize: font.lg },
  hintTxt:       { textAlign: 'center', color: colors.subtext, fontSize: font.sm, marginTop: spacing.sm },
});
