import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';
import { recommendDiet } from '../utils/api';
import { loadUser } from '../utils/storage';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MEALS = [
  ['Breakfast','breakfast'],
  ['Mid-Morning Snack','mid_morning_snack'],
  ['Lunch','lunch'],
  ['Evening Snack','evening_snack'],
  ['Dinner','dinner'],
];

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[s.chip, active && s.chipActive]}
    onPress={onPress}
  >
    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
  </TouchableOpacity>
);

const MealSection = ({ name, items, calories }) => {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={s.mealCard} onPress={() => setOpen(o => !o)}>
      <View style={s.mealHeader}>
        <Text style={s.mealName}>{name}</Text>
        <Text style={s.mealCal}>{calories} kcal {open ? '▲' : '▼'}</Text>
      </View>
      {open && items.map((item, i) => (
        <Text key={i} style={s.mealItem}>• {item}</Text>
      ))}
    </TouchableOpacity>
  );
};

export default function DietPlanScreen() {
  const [bmiCat, setBmiCat]   = useState('Normal');
  const [sport, setSport]     = useState('Swimming');
  const [intensity, setInt]   = useState('Moderate');
  const [diet, setDiet]       = useState('veg');
  const [weight, setWeight]   = useState(70);
  const [loading, setLoading] = useState(false);
  const [weekPlan, setWeekPlan] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const s = createStyles(colors);

  const generate = async () => {
    setLoading(true);
    try {
      const user = await loadUser();
      if (user) {
        setBmiCat(user.bmi_category || 'Normal');
        setDiet(user.diet_pref || 'veg');
        setWeight(user.weight_kg || 70);
      }
      // Call backend 7 times for each day variant (or use single call + rotate locally)
      // Using the single-day endpoint and cycling for all 7 days
      const days = {};
      const sports = ['Swimming','Walking','Cycling','Yoga','Running','Dancing','Football'];
      for (let i = 0; i < 7; i++) {
        const res = await recommendDiet({
          bmi_category: bmiCat,
          sport: sports[i % sports.length],
          sport_intensity: intensity,
          dietary_preference: diet,
          weight_kg: weight,
          height_cm: user?.height_cm || 170,
          age: user?.age || 25,
          gender: user?.gender || 'male',
          day_index: i,
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

  const currentDay = weekPlan ? DAYS[activeDay] : null;
  const dayPlan = currentDay ? weekPlan[currentDay] : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>Weekly Diet Plan</Text>
      <Text style={s.subtitle}>Personalised 7-day meal plan with daily variety.</Text>

      {/* BMI Category */}
      <Text style={s.label}>BMI Category</Text>
      <View style={s.chipRow}>
        {['Underweight','Normal','Overweight','Obese'].map(c => (
          <Chip key={c} label={c} active={bmiCat === c} onPress={() => setBmiCat(c)} />
        ))}
      </View>

      {/* Intensity */}
      <Text style={s.label}>Sport Intensity</Text>
      <View style={s.chipRow}>
        {['Low','Moderate','High'].map(i => (
          <Chip key={i} label={i} active={intensity === i} onPress={() => setInt(i)} />
        ))}
      </View>

      {/* Diet preference */}
      <Text style={s.label}>Diet Preference</Text>
      <View style={s.chipRow}>
        {['veg','non-veg','vegan'].map(d => (
          <Chip key={d} label={d} active={diet === d} onPress={() => setDiet(d)} />
        ))}
      </View>

      <TouchableOpacity style={s.btn} onPress={generate} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={s.btnTxt}>Generate 7-Day Plan</Text>}
      </TouchableOpacity>

      {weekPlan && (
        <>
          {/* Summary row */}
          {dayPlan && (
            <View style={s.summaryRow}>
              <View style={s.summaryBox}>
                <Text style={s.summaryVal}>{dayPlan.total_calories}</Text>
                <Text style={s.summarySub}>kcal/day</Text>
              </View>
              <View style={s.summaryBox}>
                <Text style={s.summaryVal}>{dayPlan.protein_target_g}g</Text>
                <Text style={s.summarySub}>protein</Text>
              </View>
              <View style={s.summaryBox}>
                <Text style={s.summaryVal}>{dayPlan.water_litres}L</Text>
                <Text style={s.summarySub}>water</Text>
              </View>
            </View>
          )}

          {/* Day selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayScroll}>
            {DAYS.map((day, i) => (
              <TouchableOpacity
                key={day}
                style={[s.dayTab, activeDay === i && s.dayTabActive]}
                onPress={() => setActiveDay(i)}
              >
                <Text style={[s.dayLabel, activeDay === i && s.dayLabelActive]}>{day.slice(0, 3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Meals for active day */}
          {dayPlan && (
            <View>
              <Text style={s.dayTitle}>{currentDay}</Text>
              {MEALS.map(([name, key]) => {
                const meal = dayPlan[key];
                return meal ? (
                  <MealSection
                    key={key}
                    name={meal.name}
                    items={meal.items}
                    calories={meal.approx_calories}
                  />
                ) : null;
              })}

              {dayPlan.notes?.map((n, i) => (
                <Text key={i} style={s.note}>{n}</Text>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
    title:       { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    subtitle:    { fontSize: font.md, color: colors.subtext, marginBottom: spacing.lg },
    label:       { fontSize: font.md, color: colors.subtext, marginBottom: spacing.xs, marginTop: spacing.md },
    chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip:        { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.md,
                   paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border },
    chipActive:  { backgroundColor: colors.accent, borderColor: colors.accent },
    chipTxt:     { color: colors.subtext, fontWeight: '600', fontSize: font.sm },
    chipTxtActive:{ color: colors.bg },
    btn:         { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                   alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
    btnTxt:      { color: colors.bg, fontWeight: '700', fontSize: font.lg },
    summaryRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    summaryBox:  { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                   alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    summaryVal:  { fontSize: font.xl, fontWeight: '700', color: colors.accent },
    summarySub:  { fontSize: font.sm, color: colors.subtext },
    dayScroll:   { marginBottom: spacing.md },
    dayTab:      { alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                   marginRight: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface,
                   borderWidth: 1, borderColor: colors.border, minWidth: 60 },
    dayTabActive:{ backgroundColor: colors.accent, borderColor: colors.accent },
    dayLabel:    { fontSize: font.sm, color: colors.subtext, fontWeight: '600', marginTop: 2 },
    dayLabelActive:{ color: colors.bg },
    dayTitle:    { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
    mealCard:    { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                   marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
    mealHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mealName:    { fontSize: font.md, fontWeight: '600', color: colors.text, flex: 1 },
    mealCal:     { fontSize: font.sm, color: colors.accent, fontWeight: '600' },
    mealItem:    { color: colors.subtext, fontSize: font.md, marginTop: spacing.xs },
    note:        { color: colors.subtext, fontSize: font.sm, marginTop: spacing.xs,
                   fontStyle: 'italic' },
  });
}
