/**
 * AnalysisScreen.js – Body analysis + AI sport recs + sport picker.
 * User picks a sport (any sport, not just recommended) before proceeding.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Image, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, font } from '../utils/theme';
import { analyzeBody, recommendSport } from '../utils/api';
import { loadUser, saveUser } from '../utils/storage';

// ── Full master sport list (any sport the user can choose) ─────────────────
const ALL_SPORTS = [
  'Football', 'Basketball', 'Cricket', 'Tennis', 'Badminton',
  'Swimming', 'Cycling', 'Running', 'Athletics (Track)', 'Walking',
  'Yoga', 'Gymnastics', 'Rock Climbing', 'Dance', 'Volleyball',
  'Boxing', 'Martial Arts', 'Rowing', 'Skiing', 'Water Aerobics',
  'Chair Yoga', 'Table Tennis', 'Golf', 'Hiking', 'Crossfit',
  'Weight Training', 'Pilates', 'Surfing', 'Horse Riding', 'Squash',
];

const MetricBox = ({ label, value }) => (
  <View style={s.metric}>
    <Text style={s.metricVal}>{value}</Text>
    <Text style={s.metricLabel}>{label}</Text>
  </View>
);

const SportChip = ({ sport, recommended, selected, onPress }) => (
  <TouchableOpacity
    style={[s.sportChip, selected && s.sportChipSelected]}
    onPress={onPress}
  >
    <Text style={[s.sportChipTxt, selected && s.sportChipTxtSelected]}>
      {recommended ? '⭐ ' : ''}{sport}
    </Text>
  </TouchableOpacity>
);

export default function AnalysisScreen({ navigation }) {
  const [image, setImage]           = useState(null);
  const [result, setResult]         = useState(null);
  const [recs, setRecs]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedSport, setSelected] = useState(null);
  const [showPicker, setShowPicker]  = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission denied'); return; }
    const img = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.7, base64: true,
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
    if (!image?.base64) { Alert.alert('Photo required', 'Please take or select a full-body photo first.'); return; }
    setLoading(true);
    try {
      const user = await loadUser();
      if (!user) { Alert.alert('No profile', 'Please save your profile on the Home screen first.'); setLoading(false); return; }

      const res = await analyzeBody({
        frame_b64: image.base64,
        weight_kg: user.weight_kg || 70,
        height_cm: user.height_cm || 170,
        user_id: user.id || null,
      });
      setResult(res.analysis);

      const sportRes = await recommendSport({
        bmi_category: res.analysis.bmi_result.category,
        body_type: res.analysis.body_type,
        user_id: user.id || null,
      });
      setRecs(sportRes.recommendations);

      // Auto-select top recommendation
      if (sportRes.recommendations.length > 0 && !selectedSport) {
        setSelected(sportRes.recommendations[0].sport);
      }
    } catch (e) {
      Alert.alert('Analysis failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedSport) {
      Alert.alert('Choose a sport', 'Please select a sport before continuing.');
      return;
    }
    // Persist chosen sport into stored user
    const user = await loadUser();
    if (user) {
      await saveUser({ ...user, chosen_sport: selectedSport });
    }
    navigation.navigate('Diet', { sport: selectedSport, analysis: result });
  };

  const recommendedNames = recs.map(r => r.sport);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={s.pageTitle}>📸 Body Analysis</Text>
      <Text style={s.pageSub}>Take a full-body photo — we'll compute your BMI, body type & sport fits</Text>

      {/* Image preview */}
      <View style={s.imageBox}>
        {image
          ? <Image source={{ uri: image.uri }} style={s.image} />
          : (
            <View style={s.imagePlaceholderBox}>
              <Text style={s.imagePlaceholderEmoji}>🧍</Text>
              <Text style={s.imagePlaceholderTxt}>No photo yet — stand straight, full body in frame</Text>
            </View>
          )}
      </View>

      {/* Buttons */}
      <View style={s.btnRow}>
        <TouchableOpacity style={s.photoBtn} onPress={takePhoto}>
          <Text style={s.photoBtnTxt}>📷 Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.photoBtn} onPress={pickImage}>
          <Text style={s.photoBtnTxt}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.analyseBtn, loading && { opacity: 0.6 }]} onPress={analyse} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={s.analyseBtnTxt}>🔍 Analyse Body</Text>}
      </TouchableOpacity>

      {/* Results */}
      {result && (
        <>
          <View style={s.divider} />
          <Text style={s.sectionTitle}>📊 Your Results</Text>

          <View style={s.metricsRow}>
            <MetricBox label="BMI" value={result.bmi_result.bmi.toFixed(1)} />
            <MetricBox label="Category" value={result.bmi_result.category} />
            <MetricBox label="Body Type" value={result.body_type} />
          </View>

          {result.shoulder_hip_ratio && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Shoulder/Hip Ratio</Text>
              <Text style={s.infoValue}>{result.shoulder_hip_ratio.toFixed(2)}</Text>
            </View>
          )}

          <View style={s.hintCard}>
            <Text style={s.hintTxt}>💡 {result.recommendations_hint}</Text>
          </View>

          {/* Sport selection */}
          <View style={s.divider} />
          <Text style={s.sectionTitle}>🏅 Choose Your Sport</Text>
          <View style={s.noteCard}>
            <Text style={s.noteTxt}>
              ⭐ <Text style={{ color: colors.accent }}>Starred sports</Text> are AI-recommended for your body. But you can pick <Text style={{ fontWeight: '700', color: colors.text }}>any sport you enjoy</Text> — the plan will be built around your choice.
            </Text>
          </View>

          {/* Recommended first */}
          {recs.length > 0 && (
            <>
              <Text style={s.subLabel}>AI Recommended</Text>
              <View style={s.chipGrid}>
                {recs.map((r, i) => (
                  <SportChip
                    key={i}
                    sport={r.sport}
                    recommended
                    selected={selectedSport === r.sport}
                    onPress={() => setSelected(r.sport)}
                  />
                ))}
              </View>
            </>
          )}

          <Text style={s.subLabel}>All Sports</Text>
          <TouchableOpacity style={s.allSportsBtn} onPress={() => setShowPicker(true)}>
            <Text style={s.allSportsBtnTxt}>
              {selectedSport && !recommendedNames.includes(selectedSport)
                ? `✅ ${selectedSport}`
                : '🔍 Browse all sports…'}
            </Text>
          </TouchableOpacity>

          {selectedSport && (
            <View style={s.selectedBanner}>
              <Text style={s.selectedLabel}>Selected Sport</Text>
              <Text style={s.selectedSport}>{selectedSport}</Text>
              <Text style={s.selectedHint}>Your diet plan & training will be built around this.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.continueBtn, !selectedSport && s.continueBtnDisabled]}
            onPress={handleContinue}
          >
            <Text style={s.continueBtnTxt}>
              {selectedSport ? `Continue with ${selectedSport} →` : 'Select a sport to continue'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Sport picker modal */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Choose Any Sport</Text>
            <FlatList
              data={ALL_SPORTS}
              keyExtractor={item => item}
              numColumns={2}
              columnWrapperStyle={{ gap: spacing.sm, marginBottom: spacing.sm }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.modalChip, selectedSport === item && s.modalChipSelected]}
                  onPress={() => { setSelected(item); setShowPicker(false); }}
                >
                  <Text style={[s.modalChipTxt, selectedSport === item && s.modalChipTxtSelected]}>
                    {recommendedNames.includes(item) ? '⭐ ' : ''}{item}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={s.modalClose} onPress={() => setShowPicker(false)}>
              <Text style={s.modalCloseTxt}>✕ Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  pageTitle:        { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  pageSub:          { fontSize: font.md, color: colors.subtext, marginBottom: spacing.lg },

  imageBox:         { height: 240, backgroundColor: colors.surface, borderRadius: radius.lg,
                      overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  image:            { width: '100%', height: '100%' },
  imagePlaceholderBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  imagePlaceholderEmoji: { fontSize: 48, marginBottom: spacing.sm },
  imagePlaceholderTxt:   { color: colors.subtext, textAlign: 'center', fontSize: font.md },

  btnRow:           { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  photoBtn:         { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                      alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  photoBtnTxt:      { color: colors.text, fontWeight: '600', fontSize: font.md },

  analyseBtn:       { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                      alignItems: 'center', marginBottom: spacing.lg },
  analyseBtnTxt:    { color: colors.bg, fontWeight: '700', fontSize: font.lg },

  divider:          { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  sectionTitle:     { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  subLabel:         { fontSize: font.sm, color: colors.subtext, fontWeight: '600',
                      marginBottom: spacing.sm, marginTop: spacing.sm },

  metricsRow:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metric:           { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                      alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  metricVal:        { fontSize: font.xl, fontWeight: '700', color: colors.accent },
  metricLabel:      { fontSize: font.sm, color: colors.subtext, marginTop: 2, textAlign: 'center' },

  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface,
                      borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
                      borderWidth: 1, borderColor: colors.border },
  infoLabel:        { color: colors.subtext, fontSize: font.md },
  infoValue:        { color: colors.text, fontWeight: '600', fontSize: font.md },

  hintCard:         { backgroundColor: '#0d2b1a', borderRadius: radius.md, padding: spacing.md,
                      borderWidth: 1, borderColor: colors.accent, marginBottom: spacing.md },
  hintTxt:          { color: colors.accent, fontSize: font.md },

  noteCard:         { backgroundColor: '#1a1f35', borderRadius: radius.md, padding: spacing.md,
                      borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  noteTxt:          { color: colors.subtext, fontSize: font.md, lineHeight: 20 },

  chipGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  sportChip:        { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sportChipSelected:{ backgroundColor: colors.accent, borderColor: colors.accent },
  sportChipTxt:     { color: colors.subtext, fontWeight: '600', fontSize: font.sm },
  sportChipTxtSelected: { color: colors.bg },

  allSportsBtn:     { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
                      alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  allSportsBtnTxt:  { color: colors.text, fontWeight: '600', fontSize: font.md },

  selectedBanner:   { backgroundColor: '#0d1f3c', borderRadius: radius.md, padding: spacing.md,
                      borderWidth: 1, borderColor: colors.blue, marginBottom: spacing.md },
  selectedLabel:    { fontSize: font.sm, color: colors.blue, fontWeight: '700' },
  selectedSport:    { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginTop: 2 },
  selectedHint:     { fontSize: font.sm, color: colors.subtext, marginTop: 4 },

  continueBtn:      { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
                      alignItems: 'center', marginBottom: spacing.xl },
  continueBtnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  continueBtnTxt:   { color: colors.bg, fontWeight: '700', fontSize: font.lg },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:        { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
                      borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '80%' },
  modalTitle:       { fontSize: font.xl, fontWeight: '700', color: colors.text,
                      marginBottom: spacing.lg, textAlign: 'center' },
  modalChip:        { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md,
                      alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modalChipSelected:{ backgroundColor: colors.accent, borderColor: colors.accent },
  modalChipTxt:     { color: colors.subtext, fontWeight: '600', fontSize: font.sm, textAlign: 'center' },
  modalChipTxtSelected: { color: colors.bg },
  modalClose:       { backgroundColor: colors.border, borderRadius: radius.md, padding: spacing.md,
                      alignItems: 'center', marginTop: spacing.md },
  modalCloseTxt:    { color: colors.text, fontWeight: '600', fontSize: font.md },
});
