/**
 * DietScreen.js - Final plan hub.
 * Diet, exercise, and progress live here as switchable views.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { colors, spacing, radius, font } from '../utils/theme';
import {
  recommendDiet, startSession, endSession,
  getProgress, getUserSummary,
} from '../utils/api';
import { loadUser, setJourneyComplete } from '../utils/storage';
import { getSportExercises, EXERCISE_INFO, DIFFICULTY_COLORS, formatSportName } from '../utils/exerciseData';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ICONS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MEALS = [
  ['Breakfast', 'breakfast'],
  ['Mid-Morning', 'mid_morning_snack'],
  ['Lunch', 'lunch'],
  ['Evening Snack', 'evening_snack'],
  ['Dinner', 'dinner'],
];
const W = Dimensions.get('window').width - spacing.md * 4;

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  color: (opacity = 1) => `rgba(0, 230, 118, ${opacity})`,
  labelColor: () => colors.subtext,
  strokeWidth: 2,
  propsForDots: { r: '4', strokeWidth: '2', stroke: colors.accent },
};

const sportLabel = sport => formatSportName(sport).replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());

const MealCard = ({ name, meal }) => {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={s.mealCard} onPress={() => setOpen(v => !v)} activeOpacity={0.85}>
      <View style={s.rowBetween}>
        <Text style={s.mealName}>{name}</Text>
        <Text style={s.mealCal}>
          {meal?.portion_g || 100}g · {meal?.approx_calories || 0} kcal {open ? '▲' : '▼'}
        </Text>
      </View>
      {open && meal?.items?.map((item, i) => (
        <Text key={i} style={s.mealItem}>- {item}</Text>
      ))}
    </TouchableOpacity>
  );
};

const ExerciseCard = ({ exKey, disabled, onStart }) => {
  const info = EXERCISE_INFO[exKey];
  if (!info) return null;
  const diffColor = DIFFICULTY_COLORS[info.difficulty] || colors.subtext;
  return (
    <View style={s.exerciseCard}>
      <View style={s.exerciseTop}>
        <View style={s.exerciseIcon}>
          <Text style={s.exerciseIconTxt}>{info.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.exerciseName}>{info.name}</Text>
          <Text style={s.exerciseMeta}>{info.muscles}</Text>
        </View>
        <View style={[s.diffBadge, { borderColor: diffColor }]}>
          <Text style={[s.diffBadgeTxt, { color: diffColor }]}>{info.difficulty}</Text>
        </View>
        <TouchableOpacity
          style={[s.smallAction, disabled && { opacity: 0.5 }]}
          onPress={() => onStart(exKey)}
          disabled={disabled}
        >
          <Text style={s.smallActionTxt}>Track</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.tipText}>{info.instructions}</Text>
    </View>
  );
};

export default function DietScreen({ route, navigation }) {
  const { sport = 'cricket', analysis } = route.params || {};
  const [activeView, setActiveView] = useState('progress');
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  const [dietLoading, setDietLoading] = useState(false);
  const [weekPlan, setWeekPlan] = useState(null);
  const [activeDay, setActiveDay] = useState(0);

  const [activeExercise, setActiveExercise] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [reps, setReps] = useState(0);
  const [stage, setStage] = useState('Ready');
  const [sessionLoading, setSessionLoading] = useState(false);

  const [progressLoading, setProgressLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [chartTab, setChartTab] = useState('bmi');

  useEffect(() => {
    loadUser().then(setUser);
  }, []);

  const loadProgress = useCallback(async () => {
    const currentUser = user || await loadUser();
    if (!currentUser?.id) return;
    setProgressLoading(true);
    try {
      const [sumRes, progRes] = await Promise.all([
        getUserSummary(currentUser.id),
        getProgress(currentUser.id),
      ]);
      setSummary(sumRes);
      setSnapshots((progRes.snapshots || []).reverse());
      setSessions(progRes.sessions || []);
    } catch {
      // Keep the hub usable even when no progress exists yet.
    } finally {
      setProgressLoading(false);
    }
  }, [user]);

  const generateDiet = useCallback(async () => {
    const currentUser = user || await loadUser();
    if (!currentUser) {
      Alert.alert('No profile', 'Please save your profile first.');
      return;
    }
    setDietLoading(true);
    try {
      const bmiCat = analysis?.bmi_result?.category || currentUser.bmi_category || 'Normal';
      const intensities = ['Moderate', 'High', 'Low', 'Moderate', 'High', 'Low', 'Moderate'];
      const days = {};
      for (let i = 0; i < DAYS.length; i++) {
        const dayIndex = i * 4;
        const res = await recommendDiet({
          bmi_category: bmiCat,
          sport,
          sport_intensity: intensities[i],
          dietary_preference: currentUser.diet_pref || 'veg',
          weight_kg: currentUser.weight_kg || 70,
          height_cm: currentUser.height_cm || 170,
          age: currentUser.age || 25,
          gender: currentUser.gender || 'male',
          day_index: dayIndex,
        });
        days[DAYS[i]] = res.meal_plan;
      }
      setWeekPlan(days);
    } catch (e) {
      Alert.alert('Diet error', e.message);
    } finally {
      setDietLoading(false);
    }
  }, [analysis, sport, user]);

  useEffect(() => {
    if (user && !weekPlan) generateDiet();
  }, [user, weekPlan, generateDiet]);

  useEffect(() => {
    if (activeView === 'progress') loadProgress();
  }, [activeView, loadProgress]);

  const exercises = getSportExercises(sport);
  const dayPlan = weekPlan ? weekPlan[DAYS[activeDay]] : null;

  const startExercise = async (exKey) => {
    const currentUser = user || await loadUser();
    if (!currentUser?.id) {
      Alert.alert('No profile', 'Please save your profile first.');
      return;
    }
    setSessionLoading(true);
    try {
      const res = await startSession({ user_id: currentUser.id, exercise: exKey });
      navigation.navigate('ExerciseMonitor', {
        exerciseKey: exKey,
        sessionId: res.session_id,
        sport,
        analysis,
      });
    } catch (e) {
      Alert.alert('Session error', e.message);
    } finally {
      setSessionLoading(false);
    }
  };

  const stopExercise = async () => {
    if (!sessionId) return;
    setSessionLoading(true);
    try {
      await endSession(sessionId, { total_reps: reps });
      await setJourneyComplete();
      setActiveExercise(null);
      setSessionId(null);
      setStage('Ready');
      setReps(0);
      await loadProgress();
      Alert.alert('Session saved', 'Your exercise progress was saved.');
    } catch (e) {
      Alert.alert('Session error', e.message);
    } finally {
      setSessionLoading(false);
    }
  };

  const addRep = () => {
    setReps(r => r + 1);
    setStage(prev => prev === 'UP' ? 'DOWN' : 'UP');
  };

  const bmiData = snapshots.slice(-7).map(item => item.bmi || 0);
  const weightData = snapshots.slice(-7).map(item => item.weight_kg || 0);
  const repData = sessions.slice(-7).map(item => item.total_reps || 0);
  const labels = snapshots.slice(-7).map((_, i) => `D${i + 1}`);
  const sessionLabels = sessions.slice(-7).map((_, i) => `S${i + 1}`);
  const displayName = user?.username || 'Athlete';
  const pageTitle = {
    progress: 'Progress',
    diet: 'Diet Plan',
    exercise: 'Exercise',
    account: 'Account Info',
    settings: 'Settings',
  }[activeView] || 'Progress';

  const openView = (view) => {
    setActiveView(view);
    setMenuOpen(false);
  };

  const renderDiet = () => (
    <>
      {analysis && (
        <View style={s.summaryCard}>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>{analysis.bmi_result?.bmi?.toFixed(1)}</Text>
            <Text style={s.summarySub}>BMI</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>{analysis.bmi_result?.category || '-'}</Text>
            <Text style={s.summarySub}>Category</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>{analysis.body_type || '-'}</Text>
            <Text style={s.summarySub}>Body Type</Text>
          </View>
        </View>
      )}

      {dietLoading && (
        <View style={s.loadingBox}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.loadingTxt}>Building your 7-day plan...</Text>
        </View>
      )}

      {!dietLoading && weekPlan && dayPlan && (
        <>
          <View style={s.fuelCard}>
            <View style={s.fuelHeader}>
              <View>
                <Text style={s.fuelLabel}>Daily fuel target</Text>
                <Text style={s.fuelCalories}>{dayPlan.total_calories} kcal</Text>
              </View>
              <View style={s.fuelBadge}>
                <Text style={s.fuelBadgeTxt}>{dayPlan.sport_category || 'Mixed'}</Text>
              </View>
            </View>
            <View style={s.fuelFormula}>
              <Text style={s.formulaText}>BMR {dayPlan.bmr || '-'} kcal</Text>
              <Text style={s.formulaDot}>x</Text>
              <Text style={s.formulaText}>{dayPlan.activity_multiplier || '-'} sport load</Text>
            </View>
          </View>

          <View style={s.macroRow}>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{dayPlan.protein_target_g}g</Text>
              <Text style={s.macroLabel}>protein</Text>
            </View>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{dayPlan.carbs_target_g || 0}g</Text>
              <Text style={s.macroLabel}>carbs</Text>
            </View>
            <View style={s.macroBox}>
              <Text style={s.macroVal}>{dayPlan.fats_target_g || 0}g</Text>
              <Text style={s.macroLabel}>fats</Text>
            </View>
          </View>

          <View style={s.hydrationRow}>
            <Text style={s.hydrationTxt}>Water target</Text>
            <Text style={s.hydrationVal}>{dayPlan.water_litres}L/day</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayScroll}>
            {DAYS.map((day, i) => (
              <TouchableOpacity
                key={day}
                style={[s.dayTab, activeDay === i && s.dayTabActive]}
                onPress={() => setActiveDay(i)}
              >
                <Text style={[s.dayTxt, activeDay === i && s.dayTxtActive]}>{DAY_ICONS[i]}</Text>
                <Text style={[s.dayMini, activeDay === i && s.dayTxtActive]}>{day.slice(0, 3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.sectionTitle}>{DAYS[activeDay]}</Text>
          {MEALS.map(([name, key]) => (
            dayPlan[key] ? <MealCard key={key} name={name} meal={dayPlan[key]} /> : null
          ))}
          {dayPlan.notes?.map((note, i) => (
            <Text key={i} style={s.note}>- {note}</Text>
          ))}
        </>
      )}

      <TouchableOpacity style={s.secondaryBtn} onPress={generateDiet} disabled={dietLoading}>
        <Text style={s.secondaryBtnTxt}>Regenerate Diet</Text>
      </TouchableOpacity>
    </>
  );

  const renderExercise = () => (
    <>
      {activeExercise ? (
        <View style={s.trackerCard}>
          <Text style={s.trackerTitle}>{EXERCISE_INFO[activeExercise].name}</Text>
          <Text style={s.repCount}>{reps}</Text>
          <Text style={s.repLabel}>REPS</Text>
          <View style={s.stageRow}>
            <View style={[s.stageBadge, stage === 'UP' && s.stageActive]}>
              <Text style={s.stageTxt}>UP</Text>
            </View>
            <View style={[s.stageBadge, stage === 'DOWN' && s.stageActive]}>
              <Text style={s.stageTxt}>DOWN</Text>
            </View>
          </View>
          <Text style={s.tipText}>{EXERCISE_INFO[activeExercise].tip}</Text>
          <View style={s.manualRow}>
            <TouchableOpacity style={s.primaryBtn} onPress={addRep}>
              <Text style={s.primaryBtnTxt}>+ Rep</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtnInline} onPress={() => setReps(r => Math.max(0, r - 1))}>
              <Text style={s.secondaryBtnTxt}>Undo</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.stopBtn} onPress={stopExercise} disabled={sessionLoading}>
            {sessionLoading ? <ActivityIndicator color={colors.bg} /> : <Text style={s.stopBtnTxt}>Stop & Save</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={s.sectionTitle}>Exercise Plan</Text>
          <Text style={s.sectionSub}>Five focused movements for {sportLabel(sport)}. Tap one to launch live AI monitoring.</Text>
          {exercises.map(ex => (
            <ExerciseCard key={ex} exKey={ex} onStart={startExercise} disabled={sessionLoading} />
          ))}
          <View style={s.orderCard}>
            <Text style={s.orderTitle}>Workout Order</Text>
            {exercises.map((ex, i) => (
              <View key={ex} style={s.orderRow}>
                <Text style={s.orderNum}>{i + 1}</Text>
                <Text style={s.orderName}>{EXERCISE_INFO[ex].name}</Text>
                <Text style={s.orderSets}>
                  {EXERCISE_INFO[ex].type === 'timer' ? `${EXERCISE_INFO[ex].target_duration}s` : `3 x ${EXERCISE_INFO[ex].target_reps}`}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={s.trainingBtn}
            onPress={() => navigation.navigate('Training', { sport, analysis })}
          >
            <Text style={s.trainingBtnTxt}>Open Monitored Training</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  const renderProgress = () => (
    <>
      <View style={s.progressHero}>
        <Text style={s.progressKicker}>Welcome back</Text>
        <Text style={s.progressName}>{displayName}</Text>
        <Text style={s.progressText}>
          Your progress, diet, and exercise plan for {sportLabel(sport)} are together here.
        </Text>
      </View>

      {progressLoading && <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />}
      <View style={s.metricsRow}>
        <View style={s.metric}>
          <Text style={s.metricVal}>{summary?.total_reps || 0}</Text>
          <Text style={s.metricLabel}>Reps</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricVal}>{summary?.total_sessions || 0}</Text>
          <Text style={s.metricLabel}>Sessions</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricVal}>{summary?.user?.bmi?.toFixed(1) || '-'}</Text>
          <Text style={s.metricLabel}>BMI</Text>
        </View>
      </View>

      <View style={s.segmentRow}>
        <TouchableOpacity style={s.transferBtn} onPress={() => openView('diet')}>
          <Text style={s.transferTxt}>Diet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.transferBtn} onPress={() => openView('exercise')}>
          <Text style={s.transferTxt}>Exercise</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Progress</Text>
      <View style={s.segmentRow}>
        {[
          ['bmi', 'BMI'],
          ['weight', 'Weight'],
          ['reps', 'Reps'],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[s.segmentBtn, chartTab === key && s.segmentActive]}
            onPress={() => setChartTab(key)}
          >
            <Text style={[s.segmentTxt, chartTab === key && s.segmentTxtActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {chartTab === 'bmi' && bmiData.length > 1 && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>BMI History</Text>
          <LineChart data={{ labels, datasets: [{ data: bmiData }] }} width={W} height={190} chartConfig={chartConfig} bezier />
        </View>
      )}
      {chartTab === 'weight' && weightData.length > 1 && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Weight History</Text>
          <LineChart
            data={{ labels, datasets: [{ data: weightData, color: () => colors.blue }] }}
            width={W}
            height={190}
            chartConfig={{ ...chartConfig, color: () => colors.blue }}
            bezier
          />
        </View>
      )}
      {chartTab === 'reps' && repData.length > 0 && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Reps per Session</Text>
          <BarChart data={{ labels: sessionLabels, datasets: [{ data: repData }] }} width={W} height={190} chartConfig={chartConfig} />
        </View>
      )}
      {((chartTab === 'bmi' && bmiData.length <= 1) || (chartTab === 'weight' && weightData.length <= 1) || (chartTab === 'reps' && repData.length === 0)) && (
        <View style={s.emptyCard}>
          <Text style={s.emptyTitle}>Not enough data yet</Text>
          <Text style={s.emptyText}>Complete analyses and save exercise sessions to build your progress.</Text>
        </View>
      )}

      {sessions.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Recent Sessions</Text>
          {sessions.slice(0, 5).map((sess, i) => (
            <View key={`${sess.id || i}`} style={s.sessionCard}>
              <Text style={s.sessionName}>{String(sess.exercise || '').replace('_', ' ').toUpperCase()}</Text>
              <Text style={s.sessionMeta}>{sess.total_reps || 0} reps · {new Date(sess.started_at).toLocaleDateString()}</Text>
            </View>
          ))}
        </>
      )}
      <TouchableOpacity style={s.secondaryBtn} onPress={loadProgress}>
        <Text style={s.secondaryBtnTxt}>Refresh Progress</Text>
      </TouchableOpacity>
    </>
  );

  const renderAccount = () => (
    <View style={s.infoCard}>
      {[
        ['Name', displayName],
        ['Age', user?.age || '-'],
        ['Gender', user?.gender || '-'],
        ['Height', user?.height_cm ? `${user.height_cm} cm` : '-'],
        ['Weight', user?.weight_kg ? `${user.weight_kg} kg` : '-'],
        ['Diet', user?.diet_pref || '-'],
        ['Sport', sportLabel(sport)],
      ].map(([label, value]) => (
        <View key={label} style={s.infoLine}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );

  const renderSettings = () => (
    <>
      <View style={s.infoCard}>
        <Text style={s.settingTitle}>Plan Preferences</Text>
        <View style={s.settingRow}>
          <Text style={s.settingLabel}>Progress start page</Text>
          <Text style={s.settingValue}>On</Text>
        </View>
        <View style={s.settingRow}>
          <Text style={s.settingLabel}>Diet auto-generation</Text>
          <Text style={s.settingValue}>On</Text>
        </View>
        <View style={s.settingRow}>
          <Text style={s.settingLabel}>Progress refresh</Text>
          <Text style={s.settingValue}>Manual</Text>
        </View>
      </View>
      <TouchableOpacity style={s.secondaryBtn} onPress={() => openView('progress')}>
        <Text style={s.secondaryBtnTxt}>Back to Progress</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={s.root}>
      {menuOpen && (
        <TouchableOpacity style={s.scrim} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={s.sideMenu}>
            <Text style={s.menuTitle}>Menu</Text>
            <Text style={s.menuSub}>{displayName}</Text>
            {[
              ['progress', 'Progress'],
              ['diet', 'Diet'],
              ['exercise', 'Exercise'],
              ['account', 'Account Info'],
              ['settings', 'Settings'],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[s.menuItem, activeView === key && s.menuItemActive]}
                onPress={() => openView(key)}
              >
                <Text style={[s.menuItemTxt, activeView === key && s.menuItemTxtActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 96 }}>
        <View style={s.topBar}>
          <TouchableOpacity style={s.menuBtn} onPress={() => setMenuOpen(true)}>
            <Text style={s.menuBtnTxt}>Menu</Text>
          </TouchableOpacity>
          <Text style={s.topName}>{displayName}</Text>
        </View>

        <View style={s.header}>
          <View>
            <Text style={s.pageTitle}>{pageTitle}</Text>
            <Text style={s.pageSub}>{sportLabel(sport)} · Diet, exercise, and progress</Text>
          </View>
          <View style={s.sportBadge}>
            <Text style={s.sportBadgeTxt}>{sportLabel(sport)}</Text>
          </View>
        </View>

        {activeView === 'diet' && renderDiet()}
        {activeView === 'exercise' && renderExercise()}
        {activeView === 'progress' && renderProgress()}
        {activeView === 'account' && renderAccount()}
        {activeView === 'settings' && renderSettings()}
      </ScrollView>

      <View style={s.bottomTabs}>
        {[
          ['diet', 'D', 'Diet'],
          ['exercise', 'E', 'Exercise'],
        ].map(([key, icon, label]) => (
          <TouchableOpacity
            key={key}
            style={[s.bottomTab, activeView === key && s.bottomTabActive]}
            onPress={() => openView(key)}
          >
            <Text style={[s.bottomIcon, activeView === key && s.bottomTxtActive]}>{icon}</Text>
            <Text style={[s.bottomLabel, activeView === key && s.bottomTxtActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  sideMenu: { width: 250, minHeight: '100%', backgroundColor: colors.surface, paddingTop: spacing.xl, paddingHorizontal: spacing.md, borderRightWidth: 1, borderRightColor: colors.border },
  menuTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: spacing.xs },
  menuSub: { color: colors.subtext, fontSize: font.md, marginBottom: spacing.lg },
  menuItem: { borderRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  menuItemActive: { backgroundColor: colors.accent },
  menuItemTxt: { color: colors.subtext, fontWeight: '700', fontSize: font.md },
  menuItemTxtActive: { color: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  menuBtn: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  menuBtnTxt: { color: colors.accent, fontWeight: '800', fontSize: font.md },
  topName: { color: colors.subtext, fontWeight: '700', fontSize: font.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.lg, gap: spacing.md },
  pageTitle: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  pageSub: { fontSize: font.md, color: colors.subtext, marginTop: spacing.xs },
  sportBadge: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, maxWidth: 120 },
  sportBadgeTxt: { color: colors.bg, fontWeight: '700', fontSize: font.sm, textAlign: 'center' },
  progressHero: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  progressKicker: { color: colors.accent, fontWeight: '800', fontSize: font.sm, marginBottom: spacing.xs },
  progressName: { color: colors.text, fontWeight: '900', fontSize: font.xxl, marginBottom: spacing.xs },
  progressText: { color: colors.subtext, fontSize: font.md, lineHeight: 20 },
  transferBtn: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  transferTxt: { color: colors.accent, fontWeight: '800', fontSize: font.md },

  summaryCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: font.lg, fontWeight: '700', color: colors.accent, textAlign: 'center' },
  summarySub: { fontSize: font.sm, color: colors.subtext, marginTop: 2 },
  loadingBox: { alignItems: 'center', padding: spacing.xl },
  loadingTxt: { color: colors.subtext, marginTop: spacing.md },

  fuelCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  fuelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  fuelLabel: { color: colors.subtext, fontSize: font.sm, fontWeight: '700', marginBottom: spacing.xs },
  fuelCalories: { color: colors.text, fontSize: 30, fontWeight: '900' },
  fuelBadge: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, maxWidth: 120 },
  fuelBadgeTxt: { color: colors.bg, fontSize: font.sm, fontWeight: '800', textAlign: 'center' },
  fuelFormula: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  formulaText: { color: colors.subtext, fontSize: font.md, fontWeight: '700' },
  formulaDot: { color: colors.accent, fontSize: font.lg, fontWeight: '900' },
  macroRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  macroBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  macroVal: { fontSize: font.xl, fontWeight: '700', color: colors.accent },
  macroLabel: { fontSize: font.sm, color: colors.subtext, marginTop: 2 },
  hydrationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  hydrationTxt: { color: colors.subtext, fontSize: font.md, fontWeight: '700' },
  hydrationVal: { color: colors.accent, fontSize: font.md, fontWeight: '800' },
  dayScroll: { marginBottom: spacing.md },
  dayTab: { alignItems: 'center', justifyContent: 'center', minWidth: 58, paddingVertical: spacing.sm, marginRight: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dayTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayTxt: { color: colors.subtext, fontWeight: '800', fontSize: font.md },
  dayMini: { color: colors.subtext, fontSize: font.sm, marginTop: 2 },
  dayTxtActive: { color: colors.bg },
  sectionTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  sectionSub: { fontSize: font.md, color: colors.subtext, marginBottom: spacing.md },
  mealCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  mealName: { color: colors.text, fontWeight: '700', fontSize: font.md, flex: 1 },
  mealCal: { color: colors.accent, fontWeight: '700', fontSize: font.sm },
  mealItem: { color: colors.subtext, fontSize: font.md, marginTop: spacing.xs },
  note: { color: colors.subtext, fontSize: font.sm, marginTop: spacing.xs },

  exerciseCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  exerciseTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  exerciseIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  exerciseIconTxt: { color: colors.accent, fontWeight: '900', fontSize: font.lg },
  exerciseName: { color: colors.text, fontWeight: '700', fontSize: font.lg },
  exerciseMeta: { color: colors.subtext, fontSize: font.sm, marginTop: 2 },
  diffBadge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  diffBadgeTxt: { fontSize: font.xs, fontWeight: '800' },
  tipText: { color: colors.subtext, fontSize: font.md, lineHeight: 20 },
  smallAction: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  smallActionTxt: { color: colors.bg, fontWeight: '700' },
  trackerCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.blue, marginBottom: spacing.lg },
  trackerTitle: { color: colors.text, fontWeight: '700', fontSize: font.xl, textAlign: 'center' },
  repCount: { color: colors.accent, fontWeight: '900', fontSize: 72, textAlign: 'center', marginTop: spacing.md },
  repLabel: { color: colors.subtext, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
  stageRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.md },
  stageBadge: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  stageActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  stageTxt: { color: colors.text, fontWeight: '700' },
  manualRow: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.md },
  primaryBtn: { flex: 2, backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  primaryBtnTxt: { color: colors.bg, fontWeight: '800', fontSize: font.lg },
  secondaryBtnInline: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  stopBtn: { backgroundColor: colors.red, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  stopBtnTxt: { color: '#fff', fontWeight: '800', fontSize: font.lg },
  orderCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  orderTitle: { color: colors.text, fontWeight: '700', fontSize: font.lg, marginBottom: spacing.sm },
  orderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  orderNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, color: colors.bg, textAlign: 'center', textAlignVertical: 'center', fontWeight: '800', marginRight: spacing.sm },
  orderName: { flex: 1, color: colors.text, fontWeight: '600' },
  orderSets: { color: colors.subtext, fontWeight: '600' },
  trainingBtn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  trainingBtnTxt: { color: colors.bg, fontWeight: '800', fontSize: font.md },

  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metric: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  metricVal: { fontSize: font.xl, fontWeight: '700', color: colors.accent },
  metricLabel: { fontSize: font.sm, color: colors.subtext, marginTop: 2 },
  segmentRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  segmentBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segmentTxt: { color: colors.subtext, fontWeight: '700' },
  segmentTxtActive: { color: colors.bg },
  chartCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  chartTitle: { color: colors.text, fontWeight: '700', fontSize: font.lg, margin: spacing.sm },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontWeight: '700', fontSize: font.lg, textAlign: 'center' },
  emptyText: { color: colors.subtext, textAlign: 'center', marginTop: spacing.sm },
  sessionCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  sessionName: { color: colors.accent, fontWeight: '700' },
  sessionMeta: { color: colors.subtext, marginTop: 2 },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  infoLabel: { color: colors.subtext, fontSize: font.md, fontWeight: '700' },
  infoValue: { color: colors.text, fontSize: font.md, fontWeight: '700', flex: 1, textAlign: 'right' },
  settingTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: spacing.md },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.md },
  settingLabel: { color: colors.subtext, fontSize: font.md, flex: 1 },
  settingValue: { color: colors.accent, fontSize: font.md, fontWeight: '800' },

  secondaryBtn: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  secondaryBtnTxt: { color: colors.accent, fontWeight: '700' },
  bottomTabs: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xs, gap: spacing.xs },
  bottomTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  bottomTabActive: { backgroundColor: colors.accent },
  bottomIcon: { color: colors.subtext, fontWeight: '900', fontSize: font.lg },
  bottomLabel: { color: colors.subtext, fontSize: font.sm, fontWeight: '700', marginTop: 2 },
  bottomTxtActive: { color: colors.bg },
});
