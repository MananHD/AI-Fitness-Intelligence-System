import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Image, Alert, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, font } from '../utils/theme';
import { analyzeBody, recommendSport } from '../utils/api';
import { loadUser } from '../utils/storage';

const MetricBox = ({ label, value, unit }) => (
  <View style={s.metric}>
    <Text style={s.metricVal}>{value}</Text>
    <Text style={s.metricUnit}>{unit}</Text>
    <Text style={s.metricLabel}>{label}</Text>
  </View>
);

export default function BodyAnalysisScreen() {
  const [image, setImage]     = useState(null);
  const [weight, setWeight]   = useState(70);
  const [height, setHeight]   = useState(170);
  const [result, setResult]   = useState(null);
  const [sports, setSports]   = useState([]);
  const [loading, setLoading] = useState(false);
  const s = createStyles(colors);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission denied'); return; }
    const img = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.7,
      base64: true,
    });
    if (!img.canceled) setImage(img.assets[0]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera permission denied'); return; }
    const img = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.7, base64: true,
    });
    if (!img.canceled) setImage(img.assets[0]);
  };

  const analyse = async () => {
    if (!image?.base64) { Alert.alert('Please take or select a photo first'); return; }
    setLoading(true);
    try {
      const user = await loadUser();
      const res = await analyzeBody({
        frame_b64: image.base64,
        weight_kg: weight,
        height_cm: height,
        user_id: user?.id || null,
      });
      setResult(res.analysis);

      const sportRes = await recommendSport({
        bmi_category: res.analysis.bmi_result.category,
        body_type: res.analysis.body_type,
        user_id: user?.id || null,
      });
      setSports(sportRes.recommendations);
    } catch (e) {
      Alert.alert('Analysis failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>Body Analysis</Text>
      <Text style={s.subtitle}>Take a full-body photo to analyse BMI and body type.</Text>

      {/* Image preview */}
      <View style={s.imageBox}>
        {image
          ? <Image source={{ uri: image.uri }} style={s.image} />
          : <Text style={s.imagePlaceholder}>No photo selected</Text>}
      </View>

      {/* Camera / Gallery buttons */}
      <View style={s.row}>
        <TouchableOpacity style={s.btn2} onPress={takePhoto}>
          <Text style={s.btn2Txt}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn2} onPress={pickImage}>
          <Text style={s.btn2Txt}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Inputs */}
      <View style={s.row}>
        <TouchableOpacity style={s.numBtn} onPress={() => setWeight(w => Math.max(30, w - 0.5))}>
          <Text style={s.numBtnTxt}>−</Text>
        </TouchableOpacity>
        <View style={s.numDisplay}>
          <Text style={s.numVal}>{weight.toFixed(1)}</Text>
          <Text style={s.numLabel}>kg</Text>
        </View>
        <TouchableOpacity style={s.numBtn} onPress={() => setWeight(w => w + 0.5)}>
          <Text style={s.numBtnTxt}>+</Text>
        </TouchableOpacity>
        <View style={{ width: spacing.md }} />
        <TouchableOpacity style={s.numBtn} onPress={() => setHeight(h => Math.max(100, h - 1))}>
          <Text style={s.numBtnTxt}>−</Text>
        </TouchableOpacity>
        <View style={s.numDisplay}>
          <Text style={s.numVal}>{height}</Text>
          <Text style={s.numLabel}>cm</Text>
        </View>
        <TouchableOpacity style={s.numBtn} onPress={() => setHeight(h => h + 1)}>
          <Text style={s.numBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.analyseBtn} onPress={analyse} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={s.analyseBtnTxt}>Analyse Body</Text>}
      </TouchableOpacity>

      {result && (
        <>
          <Text style={s.sectionTitle}>Results</Text>
          <View style={s.metricsRow}>
            <MetricBox label="BMI" value={result.bmi_result.bmi.toFixed(1)} unit="" />
            <MetricBox label="Category" value={result.bmi_result.category} unit="" />
            <MetricBox label="Confidence" value={`${(result.confidence * 100).toFixed(0)}%`} unit="" />
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>Body Type</Text>
            <Text style={s.infoValue}>{result.body_type}</Text>
          </View>
          {result.shoulder_hip_ratio && (
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Shoulder/Hip Ratio</Text>
              <Text style={s.infoValue}>{result.shoulder_hip_ratio.toFixed(2)}</Text>
            </View>
          )}
          <View style={s.hintCard}>
            <Text style={s.hintTxt}>{result.recommendations_hint}</Text>
          </View>

          {sports.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Recommended Sports</Text>
              {sports.map((sp, i) => <SportCard key={i} sport={sp} styles={s} />)}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const SportCard = ({ sport, styles }) => (
  <View style={styles.sportCard}>
    <Text style={styles.sportName}>{sport.sport}</Text>
    <View style={styles.intensityBadge}>
      <Text style={styles.intensityTxt}>{sport.intensity} intensity</Text>
    </View>
    <Text style={styles.sportRationale}>{sport.rationale}</Text>
    <Text style={styles.sportMeta}>
      {sport.weekly_sessions} sessions per week  ·  {sport.duration_min} min per session
    </Text>
  </View>
);

function createStyles(colors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
    title:        { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    subtitle:     { fontSize: font.md, color: colors.subtext, marginBottom: spacing.lg },
    imageBox:     { height: 220, backgroundColor: colors.surface, borderRadius: radius.lg,
                    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                    borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
    image:        { width: '100%', height: '100%' },
    imagePlaceholder: { fontSize: font.md, color: colors.subtext },
    row:          { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    btn2:         { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
                    padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    btn2Txt:      { color: colors.text, fontWeight: '600', fontSize: font.md },
    numBtn:       { backgroundColor: colors.surface, width: 40, height: 40, borderRadius: 20,
                    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    numBtnTxt:    { color: colors.text, fontSize: font.xl, fontWeight: '700' },
    numDisplay:   { flex: 1, alignItems: 'center' },
    numVal:       { fontSize: font.xl, fontWeight: '700', color: colors.accent },
    numLabel:     { fontSize: font.sm, color: colors.subtext },
    analyseBtn:   { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                    alignItems: 'center', marginBottom: spacing.lg },
    analyseBtnTxt:{ color: colors.bg, fontWeight: '700', fontSize: font.lg },
    sectionTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text,
                    marginTop: spacing.md, marginBottom: spacing.md },
    metricsRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    metric:       { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
                    padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    metricVal:    { fontSize: font.xl, fontWeight: '700', color: colors.accent },
    metricUnit:   { fontSize: font.sm, color: colors.subtext },
    metricLabel:  { fontSize: font.sm, color: colors.subtext, marginTop: 2 },
    infoCard:     { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
                    flexDirection: 'row', justifyContent: 'space-between' },
    infoLabel:    { color: colors.subtext, fontSize: font.md },
    infoValue:    { color: colors.text, fontWeight: '600', fontSize: font.md },
    hintCard:     { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md,
                    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    hintTxt:      { color: colors.text, fontSize: font.md },
    sportCard:    { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                    marginBottom: spacing.sm, borderWidth: 1, borderLeftWidth: 4,
                    borderColor: colors.border, borderLeftColor: colors.blue },
    sportName:    { fontSize: font.lg, fontWeight: '600', color: colors.text },
    intensityBadge:{ backgroundColor: colors.surface2, borderRadius: radius.sm, alignSelf: 'flex-start',
                    paddingHorizontal: spacing.sm, paddingVertical: 2, marginVertical: spacing.xs },
    intensityTxt: { color: colors.blue, fontSize: font.sm, fontWeight: '600' },
    sportRationale:{ color: colors.subtext, fontSize: font.md },
    sportMeta:    { color: colors.subtext, fontSize: font.sm, marginTop: spacing.xs },
  });
}
