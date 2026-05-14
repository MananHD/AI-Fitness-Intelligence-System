import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';
import { createUser, listUsers } from '../utils/api';
import { saveUser, loadUser } from '../utils/storage';

const Picker = ({ label, options, value, onChange }) => (
  <View style={s.pickerWrap}>
    <Text style={s.label}>{label}</Text>
    <View style={s.pickerRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[s.chip, value === opt && s.chipActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[s.chipTxt, value === opt && s.chipTxtActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

export default function ProfileScreen() {
  const [username, setUsername]   = useState('');
  const [age, setAge]             = useState('25');
  const [height, setHeight]       = useState('170');
  const [weight, setWeight]       = useState('70');
  const [diet, setDiet]           = useState('veg');
  const [loading, setLoading]     = useState(false);
  const [saved, setSaved]         = useState(null);

  useEffect(() => {
    loadUser().then(u => { if (u) setSaved(u); });
  }, []);

  const s = createStyles(colors);

  const handleSave = async () => {
    if (!username.trim()) { Alert.alert('Error', 'Username is required'); return; }
    setLoading(true);
    try {
      const res = await createUser({
        username: username.trim(),
        age: parseInt(age),
        height_cm: parseFloat(height),
        weight_kg: parseFloat(weight),
        diet_pref: diet,
      });
      await saveUser(res.user);
      setSaved(res.user);
      Alert.alert('Saved', `Profile for ${res.user.username} is ready.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>Profile</Text>

      {saved && (
        <View style={s.savedCard}>
          <Text style={s.savedLabel}>Active Profile</Text>
          <Text style={s.savedName}>{saved.username}</Text>
          <Text style={s.savedMeta}>
            BMI: {saved.bmi ? saved.bmi.toFixed(1) : '—'}  ·  {saved.bmi_category || 'Not analysed'}
          </Text>
        </View>
      )}

      <Text style={s.sectionTitle}>Create or Update Profile</Text>

      <Text style={s.label}>Username *</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. alex_fit"
        placeholderTextColor={colors.subtext}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Age</Text>
          <TextInput style={s.input} keyboardType="numeric" value={age}
            onChangeText={setAge} placeholderTextColor={colors.subtext} />
        </View>
        <View style={{ width: spacing.sm }} />
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Height (cm)</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={height}
            onChangeText={setHeight} placeholderTextColor={colors.subtext} />
        </View>
      </View>

      <Text style={s.label}>Weight (kg)</Text>
      <TextInput style={s.input} keyboardType="decimal-pad" value={weight}
        onChangeText={setWeight} placeholderTextColor={colors.subtext} />

      <Picker
        label="Dietary Preference"
        options={['veg', 'non-veg', 'vegan']}
        value={diet}
        onChange={setDiet}
      />

      <TouchableOpacity style={s.btn} onPress={handleSave} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={s.btnTxt}>Save Profile</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
    title:        { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
    sectionTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text,
                    marginTop: spacing.lg, marginBottom: spacing.md },
    savedCard:    { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
    savedLabel:   { fontSize: font.sm, color: colors.accent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    savedName:    { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginTop: 4 },
    savedMeta:    { fontSize: font.md, color: colors.subtext, marginTop: 4 },
    label:        { fontSize: font.md, color: colors.subtext, marginBottom: spacing.xs, marginTop: spacing.sm },
    input:        { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                    color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: font.md },
    row:          { flexDirection: 'row' },
    pickerWrap:   { marginTop: spacing.md },
    pickerRow:    { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    chip:         { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm,
                    alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    chipActive:   { backgroundColor: colors.accent, borderColor: colors.accent },
    chipTxt:      { color: colors.subtext, fontWeight: '600', fontSize: font.md },
    chipTxtActive:{ color: colors.bg },
    btn:          { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                    alignItems: 'center', marginTop: spacing.xl },
    btnTxt:       { color: colors.bg, fontWeight: '700', fontSize: font.lg },
  });
}
