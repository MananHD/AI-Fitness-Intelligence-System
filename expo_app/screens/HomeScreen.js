import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image
} from 'react-native';
import { colors, spacing, radius, font } from '../utils/theme';

const FeatureCard = ({ emoji, title, subtitle }) => (
  <View style={s.card}>
    <Text style={s.emoji}>{emoji}</Text>
    <Text style={s.cardTitle}>{title}</Text>
    <Text style={s.cardSub}>{subtitle}</Text>
  </View>
);

const Step = ({ n, title, desc }) => (
  <View style={s.step}>
    <View style={s.stepNum}><Text style={s.stepNumTxt}>{n}</Text></View>
    <View style={{ flex: 1 }}>
      <Text style={s.stepTitle}>{title}</Text>
      <Text style={s.stepDesc}>{desc}</Text>
    </View>
  </View>
);

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Hero */}
      <View style={s.hero}>
        <Text style={s.heroEmoji}>🏋️</Text>
        <Text style={s.heroTitle}>AI Fitness Intelligence</Text>
        <Text style={s.heroSub}>
          Computer Vision · Personalised Recs · Real-Time Feedback
        </Text>
      </View>

      {/* Feature cards */}
      <View style={s.row}>
        <FeatureCard emoji="👁️" title="CV Core" subtitle="MediaPipe · 33 Keypoints" />
        <FeatureCard emoji="🏃" title="3 Exercises" subtitle="Squat · Pushup · Jump" />
        <FeatureCard emoji="🥗" title="7-Day Plan" subtitle="12 BMI × Diet combos" />
      </View>

      {/* Quick start */}
      <Text style={s.sectionTitle}>🚀 Quick Start</Text>
      <Step n="1" title="👤 Profile" desc="Enter your height, weight & diet preference" />
      <Step n="2" title="📸 Body Analysis" desc="Take a photo → get BMI + sport recommendations" />
      <Step n="3" title="🥗 Diet Plan" desc="View your personalised weekly meal plan" />
      <Step n="4" title="📊 Progress" desc="Track BMI and workout history over time" />

      {/* CTA */}
      <TouchableOpacity style={s.cta} onPress={() => navigation.navigate('Profile')}>
        <Text style={s.ctaTxt}>Get Started →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  hero:         { alignItems: 'center', paddingVertical: spacing.xl },
  heroEmoji:    { fontSize: 56, marginBottom: spacing.sm },
  heroTitle:    { fontSize: font.xxl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  heroSub:      { fontSize: font.md, color: colors.subtext, textAlign: 'center', marginTop: spacing.xs },
  row:          { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  card:         { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
                  padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  emoji:        { fontSize: 28, marginBottom: spacing.xs },
  cardTitle:    { fontSize: font.lg, fontWeight: '700', color: colors.accent },
  cardSub:      { fontSize: font.sm, color: colors.subtext, marginTop: 2 },
  sectionTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text,
                  marginBottom: spacing.md, marginTop: spacing.sm },
  step:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md,
                  backgroundColor: colors.surface, borderRadius: radius.md,
                  padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  stepNum:      { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent,
                  alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  stepNumTxt:   { color: colors.bg, fontWeight: '700', fontSize: font.md },
  stepTitle:    { fontSize: font.lg, fontWeight: '600', color: colors.text },
  stepDesc:     { fontSize: font.sm, color: colors.subtext, marginTop: 2 },
  cta:          { backgroundColor: colors.accent, borderRadius: radius.lg,
                  padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  ctaTxt:       { color: colors.bg, fontWeight: '700', fontSize: font.lg },
});
