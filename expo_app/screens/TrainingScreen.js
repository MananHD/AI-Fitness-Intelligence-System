/**
 * TrainingScreen.js - Sport-specific exercise hub.
 * Lets the user review the workout order and open the detailed exercise flow.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';
import { getSportExercises, EXERCISE_INFO, DIFFICULTY_COLORS, formatSportName } from '../utils/exerciseData';

const ExerciseCard = ({ exKey, index, onStart }) => {
  const info = EXERCISE_INFO[exKey];
  if (!info) return null;

  const diffColor = DIFFICULTY_COLORS[info.difficulty] || colors.subtext;

  return (
    <View style={s.exerciseCard}>
      <View style={[s.rankBadge, { backgroundColor: info.color || colors.accent }]}>
        <Text style={s.rankTxt}>{index + 1}</Text>
      </View>

      <View style={s.exerciseHeader}>
        <View style={s.exerciseIconBox}>
          <Text style={s.exerciseIcon}>{info.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.exerciseNameRow}>
            <Text style={s.exerciseName}>{info.name}</Text>
            <View style={[s.diffBadge, { borderColor: diffColor }]}>
              <Text style={[s.diffTxt, { color: diffColor }]}>{info.difficulty}</Text>
            </View>
          </View>
          <Text style={s.exerciseMuscles}>{info.muscles}</Text>
        </View>
      </View>

      <View style={s.instructionBox}>
        <Text style={s.instructionTxt}>{info.instructions}</Text>
      </View>

      <View style={s.exerciseFooter}>
        <Text style={[s.exerciseBenefit, { color: info.color || colors.accent }]}>
          {info.benefit}
        </Text>
        <Text style={s.targetTxt}>
          {info.type === 'timer' ? `${info.target_duration}s hold` : `3 x ${info.target_reps} reps`}
        </Text>
      </View>

      <TouchableOpacity
        style={[s.startBtn, { backgroundColor: info.color || colors.accent }]}
        onPress={() => onStart(exKey)}
      >
        <Text style={s.startBtnTxt}>Start Exercise</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function TrainingScreen({ route, navigation }) {
  const { sport = 'Football', analysis } = route.params || {};
  const exercises = getSportExercises(sport);
  const sportName = formatSportName(sport);

  const handleStart = (exKey) => {
    navigation.navigate('ExerciseDetail', {
      exerciseKey: exKey,
      sport,
      analysis,
    });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={s.header}>
        <View>
          <Text style={s.pageTitle}>Training Plan</Text>
          <Text style={s.pageSub}>
            {exercises.length} exercises tailored for{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{sportName}</Text>
          </Text>
        </View>
        <View style={s.sportBadge}>
          <Text style={s.sportBadgeTxt}>{sportName}</Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statVal}>{exercises.length}</Text>
          <Text style={s.statLabel}>EXERCISES</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statVal}>{exercises.filter((e) => EXERCISE_INFO[e]?.type === 'rep').length}</Text>
          <Text style={s.statLabel}>REP-BASED</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statVal}>{exercises.filter((e) => EXERCISE_INFO[e]?.type === 'timer').length}</Text>
          <Text style={s.statLabel}>TIMED</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statVal}>{exercises.filter((e) => EXERCISE_INFO[e]?.difficulty === 'Advanced').length}</Text>
          <Text style={s.statLabel}>ADVANCED</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>Your Exercise Plan</Text>
      <Text style={s.sectionSub}>
        Tap any exercise for detailed instructions and AI-powered form tracking.
      </Text>

      {exercises.map((ex, i) => (
        <ExerciseCard key={ex} exKey={ex} index={i} onStart={handleStart} />
      ))}

      <View style={s.priorityCard}>
        <Text style={s.priorityTitle}>Recommended Order</Text>
        {exercises.map((ex, i) => {
          const info = EXERCISE_INFO[ex];
          return (
            <View key={ex} style={s.priorityRow}>
              <View style={[s.priorityNum, { backgroundColor: info?.color || colors.accent }]}>
                <Text style={s.priorityNumTxt}>{i + 1}</Text>
              </View>
              <Text style={s.priorityExercise}>{info?.name}</Text>
              <Text style={s.prioritySets}>
                {info?.type === 'timer' ? `${info.target_duration}s hold` : `3 x ${info?.target_reps} reps`}
              </Text>
            </View>
          );
        })}
        <Text style={s.priorityNote}>Rest 60-90 seconds between sets</Text>
      </View>

      <View style={s.cvCard}>
        <Text style={s.cvTitle}>AI Exercise Monitoring</Text>
        <Text style={s.cvTxt}>
          Each exercise uses <Text style={{ fontWeight: '700', color: colors.accent }}>MediaPipe pose detection</Text>{' '}
          to track your form in real-time. The system counts reps automatically, monitors joint angles,
          and provides instant feedback when posture drifts.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  pageTitle: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  sportBadge: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  sportBadgeTxt: { color: colors.bg, fontWeight: '700', fontSize: font.sm },
  pageSub: { fontSize: font.md, color: colors.subtext, marginBottom: spacing.lg, lineHeight: 20 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  statVal: { color: colors.accent, fontSize: font.xl, fontWeight: '800' },
  statLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', marginTop: 2, letterSpacing: 1 },
  sectionTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  sectionSub: { fontSize: font.md, color: colors.subtext, marginBottom: spacing.md, lineHeight: 20 },
  exerciseCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  rankTxt: { color: colors.bg, fontWeight: '800' },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  exerciseIconBox: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  exerciseIcon: { fontSize: font.lg, fontWeight: '900', color: colors.accent },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  exerciseName: { color: colors.text, fontSize: font.lg, fontWeight: '800', flex: 1 },
  diffBadge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  diffTxt: { fontSize: font.xs, fontWeight: '800' },
  exerciseMuscles: { color: colors.subtext, fontSize: font.sm, marginTop: 2 },
  instructionBox: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  instructionTxt: { color: colors.text, fontSize: font.md, lineHeight: 20 },
  exerciseFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md, alignItems: 'flex-start' },
  exerciseBenefit: { flex: 1, fontWeight: '700', fontSize: font.md, lineHeight: 20 },
  targetTxt: { color: colors.subtext, fontSize: font.sm, fontWeight: '700', textAlign: 'right' },
  startBtn: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  startBtnTxt: { color: '#fff', fontWeight: '800', fontSize: font.md },
  priorityCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  priorityTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: spacing.sm },
  priorityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  priorityNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  priorityNumTxt: { color: colors.bg, fontWeight: '800' },
  priorityExercise: { flex: 1, color: colors.text, fontWeight: '600' },
  prioritySets: { color: colors.subtext, fontSize: font.sm },
  priorityNote: { color: colors.subtext, fontSize: font.sm, marginTop: spacing.xs },
  cvCard: { backgroundColor: '#10213f', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.blue, marginBottom: spacing.md },
  cvTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: spacing.xs },
  cvTxt: { color: colors.subtext, fontSize: font.md, lineHeight: 20 },
});