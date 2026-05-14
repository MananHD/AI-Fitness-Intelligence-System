/**
 * HomeScreen.js – Profile data collection gate.
 * User must fill all fields and save before navigating to Analysis.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';
import { createUser } from '../utils/api';
import { saveUser, loadUser } from '../utils/storage';

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress}>
    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
  </TouchableOpacity>
);

const Field = ({ label, children }) => (
  <View style={s.fieldWrap}>
    <Text style={s.label}>{label}</Text>
    {children}
  </View>
);

export default function HomeScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [age, setAge]           = useState('');
  const [height, setHeight]     = useState('');
  const [weight, setWeight]     = useState('');
  const [diet, setDiet]         = useState('veg');
  const [gender, setGender]     = useState('male');
  const [loading, setLoading]   = useState(false);
  const [saved, setSaved]       = useState(null);

  useEffect(() => {
    loadUser().then(u => { if (u) { setSaved(u); populateFields(u); } });
  }, []);

  const populateFields = (u) => {
    setUsername(u.username || '');
    setAge(u.age ? String(u.age) : '');
    setHeight(u.height_cm ? String(u.height_cm) : '');
    setWeight(u.weight_kg ? String(u.weight_kg) : '');
    setDiet(u.diet_pref || 'veg');
    setGender(u.gender || 'male');
  };

  const isComplete = username.trim() && age && height && weight && diet;
  const s = createStyles(colors);

  const handleSave = async () => {
    if (!username.trim()) { Alert.alert('Required', 'Please enter a username'); return; }
    if (!age || isNaN(parseInt(age))) { Alert.alert('Required', 'Please enter a valid age'); return; }
    if (!height || isNaN(parseFloat(height))) { Alert.alert('Required', 'Please enter a valid height'); return; }
    if (!weight || isNaN(parseFloat(weight))) { Alert.alert('Required', 'Please enter a valid weight'); return; }

    setLoading(true);
    try {
      const res = await createUser({
        username: username.trim(),
        age: parseInt(age),
        height_cm: parseFloat(height),
        weight_kg: parseFloat(weight),
        diet_pref: diet,
        gender,
      });
      await saveUser(res.user);
      setSaved(res.user);
      Alert.alert(
        'Profile Saved',
        `Welcome, ${res.user.username}. Continuing to Body Analysis.`,
        [{ text: 'Continue', onPress: () => navigation.navigate('Analysis') }]
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.heroKicker}>Profile Setup</Text>
          <Text style={s.heroTitle}>AI Fitness Intelligence</Text>
          <Text style={s.heroSub}>Enter your details to generate personalised recommendations.</Text>
        </View>

        {/* Saved profile banner */}
        {saved && (
          <View style={s.activeBanner}>
            <Text style={s.bannerLabel}>Active Profile</Text>
            <Text style={s.bannerName}>{saved.username}</Text>
            <Text style={s.bannerMeta}>
              {saved.bmi ? `BMI ${saved.bmi.toFixed(1)} · ` : ''}{saved.bmi_category || 'Not yet analysed'}
            </Text>
          </View>
        )}



        {/* Form */}
        <View style={s.formCard}>
          <Text style={s.formTitle}>Profile Details</Text>

          <Field label="Username *">
            <TextInput
              style={s.input}
              placeholder="e.g. alex_fit"
              placeholderTextColor={colors.subtext}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </Field>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field label="Age *">
                <TextInput
                  style={s.input}
                  keyboardType="numeric"
                  placeholder="25"
                  placeholderTextColor={colors.subtext}
                  value={age}
                  onChangeText={setAge}
                />
              </Field>
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Field label="Height (cm) *">
                <TextInput
                  style={s.input}
                  keyboardType="decimal-pad"
                  placeholder="170"
                  placeholderTextColor={colors.subtext}
                  value={height}
                  onChangeText={setHeight}
                />
              </Field>
            </View>
          </View>

          <Field label="Weight (kg) *">
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="70.0"
              placeholderTextColor={colors.subtext}
              value={weight}
              onChangeText={setWeight}
            />
          </Field>

          <Field label="Dietary Preference *">
            <View style={s.chipRow}>
              {['veg', 'non-veg', 'vegan'].map(d => (
                <Chip key={d} label={d} active={diet === d} onPress={() => setDiet(d)} />
              ))}
            </View>
          </Field>

          <Field label="Gender *">
            <View style={s.chipRow}>
              {['male', 'female'].map(g => (
                <Chip key={g} label={g === 'male' ? 'Male' : 'Female'} active={gender === g} onPress={() => setGender(g)} />
              ))}
            </View>
          </Field>

          <TouchableOpacity
            style={[s.saveBtn, loading && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={s.saveBtnTxt}>Save and Continue</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header:         { alignItems: 'center', paddingVertical: spacing.xl },
  heroKicker:     { fontSize: font.sm, color: colors.accent, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.xs },
  heroTitle:      { fontSize: font.xxl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  heroSub:        { fontSize: font.md, color: colors.subtext, textAlign: 'center', marginTop: spacing.xs },

  activeBanner:   { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  bannerLabel:    { fontSize: font.sm, color: colors.accent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  bannerName:     { fontSize: font.xl, fontWeight: '700', color: colors.text, marginTop: 2 },
  bannerMeta:     { fontSize: font.sm, color: colors.subtext, marginTop: 2 },



  formCard:       { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  formTitle:      { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  fieldWrap:      { marginBottom: spacing.md },
  label:          { fontSize: font.sm, color: colors.subtext, marginBottom: spacing.xs, fontWeight: '600' },
  input:          { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md,
                    color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: font.md },

  row:            { flexDirection: 'row' },
  chipRow:        { flexDirection: 'row', gap: spacing.sm },
  chip:           { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.sm,
                    alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  chipActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt:        { color: colors.subtext, fontWeight: '600', fontSize: font.md },
  chipTxtActive:  { color: colors.bg },

  saveBtn:        { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                    alignItems: 'center', marginTop: spacing.md },
  saveBtnDisabled:{ opacity: 0.6 },
  saveBtnTxt:     { color: colors.bg, fontWeight: '700', fontSize: font.lg },
});

function createStyles(colors) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
    header:         { alignItems: 'center', paddingVertical: spacing.xl },
    heroKicker:     { fontSize: font.sm, color: colors.accent, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.xs },
    heroTitle:      { fontSize: font.xxl, fontWeight: '700', color: colors.text, textAlign: 'center' },
    heroSub:        { fontSize: font.md, color: colors.subtext, textAlign: 'center', marginTop: spacing.xs },

    activeBanner:   { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                      borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
    bannerLabel:    { fontSize: font.sm, color: colors.accent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    bannerName:     { fontSize: font.xl, fontWeight: '700', color: colors.text, marginTop: 2 },
    bannerMeta:     { fontSize: font.sm, color: colors.subtext, marginTop: 2 },



    formCard:       { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                      borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
    formTitle:      { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

    fieldWrap:      { marginBottom: spacing.md },
    label:          { fontSize: font.sm, color: colors.subtext, marginBottom: spacing.xs, fontWeight: '600' },
    input:          { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md,
                      color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: font.md },

    row:            { flexDirection: 'row' },
    chipRow:        { flexDirection: 'row', gap: spacing.sm },
    chip:           { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.sm,
                      alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    chipActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
    chipTxt:        { color: colors.subtext, fontWeight: '600', fontSize: font.md },
    chipTxtActive:  { color: colors.bg },

    saveBtn:        { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                      alignItems: 'center', marginTop: spacing.md },
    saveBtnDisabled:{ opacity: 0.6 },
    saveBtnTxt:     { color: colors.bg, fontWeight: '700', fontSize: font.lg },
  });
}
