/**
 * DietScreen.js – 7-day diet plan tailored to user's chosen sport.
 * Receives `sport` and `analysis` from route params (passed from AnalysisScreen).
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';
import { recommendDiet } from '../utils/api';
import { loadUser } from '../utils/storage';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_EMOJIS = ['🌙','🌿','🔥','💪','🎯','🏖','☀️'];
const MEALS = [
  ['🌅 Breakfast',       'breakfast'],
  ['🍎 Mid-Morning',     'mid_morning_snack'],
  ['🌞 Lunch',           'lunch'],
  ['🍊 Evening Snack',   'evening_snack'],
  ['🌙 Dinner',          'dinner'],
];

const MealCard = ({ emoji, name, items, calories }) => {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={s.mealCard} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
      <View style={s.mealHeader}>
        <Text style={s.mealName}>{emoji} {name}</Text>
        <Text style={s.mealCal}>{calories} kcal {open ? '▲' : '▼'}</Text>
      </View>
      {open && items?.map((item, i) => (
        <Text key={i} style={s.mealItem}>• {item}</Text>
      ))}
    </TouchableOpacity>
  );
};

export default function DietScreen({ route, navigation }) {
  const { sport = 'Swimming', analysis } = route.params || {};

  const [loading, setLoading]     = useState(false);
  const [weekPlan, setWeekPlan]   = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [user, setUser]           = useState(null);

  useEffect(() => {
    loadUser().then(u => setUser(u));
  }, []);

  const generate = async () => {
    if (!user) { Alert.alert('No profile', 'Please save your profile first.'); return; }
    setLoading(true);
    try {
      const bmiCat  = analysis?.bmi_result?.category || user.bmi_category || 'Normal';
      const dietPref = user.diet_pref || 'veg';
      const weightKg = user.weight_kg || 70;

      // Generate a different day variant for each day by rotating intensity
      const intensities = ['Moderate','High','Low','Moderate','High','Low','Moderate'];
      const days = {};
      for (let i = 0; i < 7; i++) {
        const res = await recommendDiet({
          bmi_category: bmiCat,
          sport,
          sport_intensity: intensities[i],
          dietary_preference: dietPref,
          weight_kg: weightKg,
        });
        days[DAYS[i]] = res.meal_plan;
      }
      setWeekPlan(days);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on mount
  useEffect(() => {
    if (user) generate();
  }, [user]);

  const dayPlan = weekPlan ? weekPlan[DAYS[activeDay]] : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.pageTitle}>🥗 Your Diet Plan</Text>
        <View style={s.sportBadge}>
          <Text style={s.sportBadgeTxt}>🏅 {sport}</Text>
        </View>
      </View>
      <Text style={s.pageSub}>
        A personalised 7-day meal plan crafted for <Text style={{ color: colors.accent }}>{sport}</Text> athletes
        {user ? ` · ${user.diet_pref} diet` : ''}
      </Text>

      {/* Analysis summary if available */}
      {analysis && (
        <View style={s.summaryCard}>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>{analysis.bmi_result?.bmi?.toFixed(1)}</Text>
            <Text style={s.summarySub}>BMI</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>{analysis.bmi_result?.category}</Text>
            <Text style={s.summarySub}>Category</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>{analysis.body_type}</Text>
            <Text style={s.summarySub}>Body Type</Text>
          </View>
        </View>
      )}

      {loading && (
        <View style={s.loadingBox}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={s.loadingTxt}>Building your 7-day plan for {sport}…</Text>
        </View>
      )}

      {!loading && !weekPlan && (
        <TouchableOpacity style={s.genBtn} onPress={generate}>
          <Text style={s.genBtnTxt}>🍽️ Generate 7-Day Plan</Text>
        </TouchableOpacity>
      )}

      {weekPlan && (
        <>
          {/* Macro summary */}
          {dayPlan && (
            <View style={s.macroRow}>
              <View style={s.macroBox}>
                <Text style={s.macroVal}>{dayPlan.total_calories}</Text>
                <Text style={s.macroLabel}>kcal/day</Text>
              </View>
              <View style={s.macroBox}>
                <Text style={s.macroVal}>{dayPlan.protein_target_g}g</Text>
                <Text style={s.macroLabel}>protein</Text>
              </View>
              <View style={s.macroBox}>
                <Text style={s.macroVal}>{dayPlan.water_litres}L</Text>
                <Text style={s.macroLabel}>water</Text>
              </View>
            </View>
          )}

          {/* Day tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayScroll}>
            {DAYS.map((day, i) => (
              <TouchableOpacity
                key={day}
                style={[s.dayTab, activeDay === i && s.dayTabActive]}
                onPress={() => setActiveDay(i)}
              >
                <Text style={s.dayEmoji}>{DAY_EMOJIS[i]}</Text>
                <Text style={[s.dayLabel, activeDay === i && s.dayLabelActive]}>
                  {day.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Meals */}
          {dayPlan && (
            <View>
              <Text style={s.dayTitle}>{DAY_EMOJIS[activeDay]} {DAYS[activeDay]}</Text>
              {MEALS.map(([emoji, key]) => {
                const meal = dayPlan[key];
                return meal ? (
                  <MealCard
                    key={key}
                    emoji={emoji}
                    name={meal.name}
                    items={meal.items}
                    calories={meal.approx_calories}
                  />
                ) : null;
              })}
              {dayPlan.notes?.map((n, i) => (
                <Text key={i} style={s.note}>ℹ️ {n}</Text>
              ))}
            </View>
          )}

          <TouchableOpacity style={s.genBtn} onPress={generate}>
            <Text style={s.genBtnTxt}>🔄 Regenerate Plan</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Navigate to Training */}
      <TouchableOpacity
        style={s.trainingBtn}
        onPress={() => navigation.navigate('Training', { sport, analysis })}
      >
        <Text style={s.trainingBtnTxt}>🏃 Go to {sport} Training →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg, padding: spacing.md },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 marginBottom: spacing.xs },
  pageTitle:   { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  sportBadge:  { backgroundColor: colors.accent, borderRadius: radius.sm,
                 paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  sportBadgeTxt:{ color: colors.bg, fontWeight: '700', fontSize: font.sm },
  pageSub:     { fontSize: font.md, color: colors.subtext, marginBottom: spacing.lg },

  summaryCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md,
                 padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal:  { fontSize: font.lg, fontWeight: '700', color: colors.accent },
  summarySub:  { fontSize: font.sm, color: colors.subtext, marginTop: 2 },

  loadingBox:  { alignItems: 'center', padding: spacing.xl },
  loadingTxt:  { color: colors.subtext, marginTop: spacing.md, fontSize: font.md },

  genBtn:      { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
                 alignItems: 'center', borderWidth: 1, borderColor: colors.accent, marginVertical: spacing.md },
  genBtnTxt:   { color: colors.accent, fontWeight: '700', fontSize: font.lg },

  macroRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  macroBox:    { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                 alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  macroVal:    { fontSize: font.xl, fontWeight: '700', color: colors.accent },
  macroLabel:  { fontSize: font.sm, color: colors.subtext, marginTop: 2 },

  dayScroll:   { marginBottom: spacing.md },
  dayTab:      { alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                 marginRight: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface,
                 borderWidth: 1, borderColor: colors.border, minWidth: 60 },
  dayTabActive:{ backgroundColor: colors.accent, borderColor: colors.accent },
  dayEmoji:    { fontSize: 20 },
  dayLabel:    { fontSize: font.sm, color: colors.subtext, fontWeight: '600', marginTop: 2 },
  dayLabelActive: { color: colors.bg },
  dayTitle:    { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  mealCard:    { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                 marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  mealHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealName:    { fontSize: font.md, fontWeight: '600', color: colors.text, flex: 1 },
  mealCal:     { fontSize: font.sm, color: colors.accent, fontWeight: '600' },
  mealItem:    { color: colors.subtext, fontSize: font.md, marginTop: spacing.xs },
  note:        { color: colors.subtext, fontSize: font.sm, marginTop: spacing.xs, fontStyle: 'italic' },

  trainingBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                 alignItems: 'center', marginTop: spacing.md },
  trainingBtnTxt: { color: colors.bg, fontWeight: '700', fontSize: font.lg },
});
