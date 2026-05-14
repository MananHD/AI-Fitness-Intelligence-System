import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';
import { getProgress, getUserSummary } from '../utils/api';
import { loadUser } from '../utils/storage';
import { LineChart, BarChart } from 'react-native-chart-kit';

const W = Dimensions.get('window').width - spacing.md * 2;

const createChartConfig = (colors) => ({
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface2,
  color: (opacity = 1) => {
    const hex = colors.accent.replace('#', '');
    const value = parseInt(hex, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  },
  labelColor: () => colors.subtext,
  strokeWidth: 2,
  propsForDots: { r: '4', strokeWidth: '2', stroke: colors.accent },
});

export default function ProgressScreen() {
  const [summary, setSummary] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const s = createStyles(colors);
  const chartConfig = createChartConfig(colors);

  const load = useCallback(async () => {
    const user = await loadUser();
    if (!user) return;
    setLoading(true);
    try {
      const [sumRes, progRes] = await Promise.all([
        getUserSummary(user.id),
        getProgress(user.id),
      ]);
      setSummary(sumRes);
      setSnapshots((progRes.snapshots || []).reverse());
      setSessions(progRes.sessions || []);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const bmiData = snapshots.slice(-7).map(s => s.bmi || 0);
  const weightData = snapshots.slice(-7).map(s => s.weight_kg || 0);
  const repData = sessions.slice(-7).map(s => s.total_reps || 0);
  const labels = snapshots.slice(-7).map((_, i) => `D${i + 1}`);
  const sessionLabels = sessions.slice(-7).map((_, i) => `S${i + 1}`);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>Progress</Text>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

      {!loading && !summary && (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>No data yet.</Text>
          <Text style={s.emptySubTxt}>
            Complete a Body Analysis to start tracking your progress.
          </Text>
          <TouchableOpacity style={s.refreshBtn} onPress={load}>
            <Text style={s.refreshTxt}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}

      {summary && (
        <>
          {/* Summary metrics */}
          <View style={s.metricsRow}>
            <View style={s.metric}>
              <Text style={s.metricVal}>{summary.total_reps || 0}</Text>
              <Text style={s.metricLabel}>Total Reps</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricVal}>{summary.total_sessions || 0}</Text>
              <Text style={s.metricLabel}>Sessions</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricVal}>{Math.round((summary.total_duration_s || 0) / 60)}</Text>
              <Text style={s.metricLabel}>Min Active</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricVal}>{summary.user?.bmi?.toFixed(1) || '—'}</Text>
              <Text style={s.metricLabel}>BMI</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {['BMI', 'Weight', 'Reps'].map((t, i) => (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, tab === i && s.tabBtnActive]}
                onPress={() => setTab(i)}
              >
                <Text style={[s.tabTxt, tab === i && s.tabTxtActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* BMI chart */}
          {tab === 0 && bmiData.length > 1 && (
            <View style={s.chartWrap}>
              <Text style={s.chartTitle}>BMI History</Text>
              <LineChart
                data={{ labels, datasets: [{ data: bmiData }] }}
                width={W} height={200}
                chartConfig={chartConfig}
                bezier
                style={{ borderRadius: radius.md }}
              />
              <View style={s.refLines}>
                <Text style={[s.refLine, { color: '#4fc3f7' }]}>── 18.5 Underweight</Text>
                <Text style={[s.refLine, { color: colors.accent }]}>── 24.9 Normal</Text>
                <Text style={[s.refLine, { color: colors.yellow }]}>── 29.9 Overweight</Text>
              </View>
            </View>
          )}

          {/* Weight chart */}
          {tab === 1 && weightData.length > 1 && (
            <View style={s.chartWrap}>
              <Text style={s.chartTitle}>Weight History (kg)</Text>
              <LineChart
                data={{ labels, datasets: [{ data: weightData, color: () => colors.blue }] }}
                width={W} height={200}
                chartConfig={{ ...chartConfig, color: () => colors.blue }}
                bezier
                style={{ borderRadius: radius.md }}
              />
            </View>
          )}

          {/* Reps chart */}
          {tab === 2 && repData.length > 0 && (
            <View style={s.chartWrap}>
              <Text style={s.chartTitle}>Reps per Session</Text>
              <BarChart
                data={{ labels: sessionLabels, datasets: [{ data: repData }] }}
                width={W} height={200}
                chartConfig={chartConfig}
                style={{ borderRadius: radius.md }}
              />
            </View>
          )}

          {(bmiData.length <= 1 && weightData.length <= 1 && repData.length === 0) && (
            <View style={s.emptyCard}>
              <Text style={s.emptyTxt}>Not enough data for charts yet.</Text>
              <Text style={s.emptySubTxt}>Do more Body Analyses and Exercise sessions.</Text>
            </View>
          )}

          {/* Session list */}
          {sessions.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Recent Sessions</Text>
              {sessions.slice(0, 10).map((sess, i) => (
                <View key={i} style={s.sessCard}>
                  <Text style={s.sessExercise}>
                    {sess.exercise?.replace('_', ' ').toUpperCase()}
                  </Text>
                  <View style={s.sessRow}>
                    <Text style={s.sessVal}>{sess.total_reps} reps</Text>
                    <Text style={s.sessVal}>{Math.round(sess.duration_s / 60)} min</Text>
                    <Text style={s.sessMeta}>
                      {new Date(sess.started_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={s.refreshBtn} onPress={load}>
            <Text style={s.refreshTxt}>Refresh</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
    title:        { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
    metricsRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    metric:       { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm,
                    alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    metricVal:    { fontSize: font.xl, fontWeight: '700', color: colors.accent },
    metricLabel:  { fontSize: font.sm, color: colors.subtext, marginTop: 2, textAlign: 'center' },
    tabRow:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    tabBtn:       { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm,
                    alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    tabBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    tabTxt:       { color: colors.subtext, fontWeight: '600' },
    tabTxtActive: { color: colors.bg },
    chartWrap:    { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
    chartTitle:   { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
    refLines:     { marginTop: spacing.sm },
    refLine:      { fontSize: font.sm, marginTop: 2 },
    sectionTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
    sessCard:     { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
    sessExercise: { fontSize: font.md, fontWeight: '700', color: colors.accent, marginBottom: spacing.xs },
    sessRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessVal:      { fontSize: font.md, fontWeight: '600', color: colors.text },
    sessMeta:     { fontSize: font.sm, color: colors.subtext },
    emptyCard:    { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xl,
                    alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    emptyTxt:     { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    emptySubTxt:  { fontSize: font.md, color: colors.subtext, textAlign: 'center' },
    refreshBtn:   { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md,
                    alignItems: 'center', marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
    refreshTxt:   { color: colors.accent, fontWeight: '600', fontSize: font.md },
  });
}
