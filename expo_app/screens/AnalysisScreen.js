/**
 * AnalysisScreen.js – Landmark-based body analysis + physical sport matching.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Image, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, font } from '../utils/theme';
import { analyzeBody, predictSportPhysical } from '../utils/api';
import { loadUser, saveUser } from '../utils/storage';

const MetricBox = ({ label, value }) => (
  <View style={s.metric}>
    <Text style={s.metricVal}>{value}</Text>
    <Text style={s.metricLabel}>{label}</Text>
  </View>
);

const ALL_SPORTS = [
  'Football', 'Basketball', 'Cricket', 'Tennis', 'Badminton',
  'Swimming', 'Cycling', 'Running', 'Athletics (Track)', 'Walking',
  'Yoga', 'Gymnastics', 'Rock Climbing', 'Dance', 'Volleyball',
  'Boxing', 'Martial Arts', 'Rowing', 'Skiing', 'Water Aerobics',
  'Chair Yoga', 'Table Tennis', 'Golf', 'Hiking', 'Crossfit',
  'Weight Training', 'Pilates', 'Surfing', 'Horse Riding', 'Squash',
];

const MatchCard = ({ item, selected, onPress, rank }) => (
  <TouchableOpacity style={[s.matchCard, selected && s.matchCardSelected]} onPress={onPress}>
    <View style={s.matchTop}>
      <Text style={[s.rankPill, rank === 1 && s.rankPillTop]}>{`#${rank}`}</Text>
      <Text style={[s.matchSport, selected && s.matchSportSelected]}>{item.sport}</Text>
      <Text style={[s.matchPct, selected && s.matchPctSelected]}>{item.confidence}%</Text>
    </View>
    <View style={s.barWrap}>
      <View style={[s.barFill, { width: `${Math.max(item.confidence, 4)}%` }]} />
    </View>
  </TouchableOpacity>
);

const prettyLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());

export default function AnalysisScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [bodyResult, setBodyResult] = useState(null);
  const [topMatches, setTopMatches] = useState([]);
  const [ratios, setRatios] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSport, setSelectedSport] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission denied'); return; }
    const img = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.9, base64: true,
    });
    if (!img.canceled) setImage(img.assets[0]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera permission denied'); return; }
    const img = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.9, base64: true,
    });
    if (!img.canceled) setImage(img.assets[0]);
  };

  const analyse = async () => {
    if (!image?.base64) {
      Alert.alert('Photo required', 'Please take or select a full-body photo first.');
      return;
    }

    setLoading(true);
    try {
      const user = await loadUser();
      if (!user) {
        Alert.alert('No profile', 'Please save your profile on the Home screen first.');
        return;
      }

      const [analysisRes, physicalRes] = await Promise.all([
        analyzeBody({
          frame_b64: image.base64,
          weight_kg: user.weight_kg || 70,
          height_cm: user.height_cm || 170,
          user_id: user.id || null,
        }),
        predictSportPhysical({
          frame_b64: image.base64,
          gender: (user.gender || 'male').toLowerCase(),
        }),
      ]);

      const normalizedTop3 = (physicalRes.top3 || []).map(([sport, confidence]) => ({
        sport,
        confidence,
      }));

      setBodyResult(analysisRes.analysis);
      setTopMatches(normalizedTop3);
      setRatios(physicalRes.features || null);
      setSelectedSport(normalizedTop3[0]?.sport || null);
    } catch (e) {
      Alert.alert('Analysis failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedSport) {
      Alert.alert('Pick a sport', 'Select one of the top physical matches first.');
      return;
    }
    const user = await loadUser();
    if (user) {
      await saveUser({ ...user, chosen_sport: selectedSport });
    }
    navigation.navigate('Diet', { sport: selectedSport, analysis: bodyResult });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={s.pageTitle}>📸 Physical Sport Analysis</Text>
      <Text style={s.pageSub}>
        We extract pose landmarks, compute body ratios (Ape Index, Crural Index, etc.), and compare your profile against trained male/female athlete clusters.
      </Text>

      <View style={s.imageBox}>
        {image
          ? <Image source={{ uri: image.uri }} style={s.image} />
          : (
            <View style={s.imagePlaceholderBox}>
              <Text style={s.imagePlaceholderEmoji}>🧍</Text>
              <Text style={s.imagePlaceholderTxt}>Upload a clear full-body image</Text>
            </View>
          )}
      </View>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.photoBtn} onPress={takePhoto}>
          <Text style={s.photoBtnTxt}>📷 Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.photoBtn} onPress={pickImage}>
          <Text style={s.photoBtnTxt}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.analyseBtn, loading && { opacity: 0.6 }]} onPress={analyse} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={s.analyseBtnTxt}>🔍 Run Landmark Analysis</Text>}
      </TouchableOpacity>

      {bodyResult && (
        <>
          <View style={s.divider} />
          <Text style={s.sectionTitle}>📊 Body Metrics</Text>
          <View style={s.metricsRow}>
            <MetricBox label="BMI" value={bodyResult.bmi_result?.bmi?.toFixed(1)} />
            <MetricBox label="Category" value={bodyResult.bmi_result?.category || '—'} />
            <MetricBox label="Body Type" value={bodyResult.body_type || '—'} />
          </View>
        </>
      )}

      {topMatches.length > 0 && (
        <>
          <View style={s.divider} />
          <Text style={s.sectionTitle}>🏅 Top 3 Sport Match</Text>
          <Text style={s.sectionSub}>
            Choose one match to generate your next Diet and Training plan.
          </Text>
          {topMatches.map((item, i) => (
            <MatchCard
              key={`${item.sport}-${i}`}
              item={item}
              rank={i + 1}
              selected={selectedSport === item.sport}
              onPress={() => setSelectedSport(item.sport)}
            />
          ))}

          <Text style={s.subLabel}>Or choose any sport</Text>
          <TouchableOpacity style={s.allSportsBtn} onPress={() => setShowPicker(true)}>
            <Text style={s.allSportsBtnTxt}>
              {selectedSport ? `✅ ${selectedSport}` : '🔍 Browse all sports...'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {ratios && (
        <>
          <View style={s.divider} />
          <Text style={s.sectionTitle}>📐 Extracted Biometric Ratios</Text>
          {Object.entries(ratios).slice(0, 8).map(([key, val]) => (
            <View key={key} style={s.infoRow}>
              <Text style={s.infoLabel}>{prettyLabel(key)}</Text>
              <Text style={s.infoValue}>{val}</Text>
            </View>
          ))}
        </>
      )}

      {selectedSport && (
        <TouchableOpacity style={s.continueBtn} onPress={handleContinue}>
          <Text style={s.continueBtnTxt}>Continue with {selectedSport} →</Text>
        </TouchableOpacity>
      )}

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
                  onPress={() => { setSelectedSport(item); setShowPicker(false); }}
                >
                  <Text style={[s.modalChipTxt, selectedSport === item && s.modalChipTxtSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={s.modalClose} onPress={() => setShowPicker(false)}>
              <Text style={s.modalCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  pageTitle: { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  pageSub: { fontSize: font.md, color: colors.subtext, marginBottom: spacing.lg, lineHeight: 20 },

  imageBox: {
    height: 240, backgroundColor: colors.surface, borderRadius: radius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholderBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  imagePlaceholderEmoji: { fontSize: 48, marginBottom: spacing.sm },
  imagePlaceholderTxt: { color: colors.subtext, textAlign: 'center', fontSize: font.md },

  btnRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  photoBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  photoBtnTxt: { color: colors.text, fontWeight: '600', fontSize: font.md },
  analyseBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', marginBottom: spacing.lg,
  },
  analyseBtnTxt: { color: colors.bg, fontWeight: '700', fontSize: font.lg },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  sectionTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  sectionSub: { fontSize: font.sm, color: colors.subtext, marginBottom: spacing.sm },
  subLabel: { fontSize: font.sm, color: colors.subtext, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.sm },

  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metric: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  metricVal: { fontSize: font.lg, fontWeight: '700', color: colors.accent, textAlign: 'center' },
  metricLabel: { fontSize: font.sm, color: colors.subtext, marginTop: 2, textAlign: 'center' },

  matchCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  matchCardSelected: { borderColor: colors.accent, backgroundColor: '#0d2b1a' },
  matchTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  rankPill: {
    backgroundColor: colors.surface2, color: colors.subtext, borderRadius: radius.sm,
    overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 4, marginRight: spacing.sm,
    fontSize: font.sm, fontWeight: '700',
  },
  rankPillTop: { backgroundColor: colors.accent, color: colors.bg },
  matchSport: { flex: 1, color: colors.text, fontWeight: '700', fontSize: font.md },
  matchSportSelected: { color: colors.accent },
  matchPct: { color: colors.text, fontWeight: '700', fontSize: font.md },
  matchPctSelected: { color: colors.accent },
  barWrap: { height: 8, backgroundColor: colors.bg, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.accent },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  infoLabel: { color: colors.subtext, fontSize: font.md },
  infoValue: { color: colors.text, fontWeight: '600', fontSize: font.md },

  allSportsBtn: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  allSportsBtnTxt: { color: colors.text, fontWeight: '600', fontSize: font.md },

  continueBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl,
  },
  continueBtnTxt: { color: colors.bg, fontWeight: '700', fontSize: font.lg },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '80%',
  },
  modalTitle: {
    fontSize: font.xl, fontWeight: '700', color: colors.text,
    marginBottom: spacing.lg, textAlign: 'center',
  },
  modalChip: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  modalChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  modalChipTxt: { color: colors.subtext, fontWeight: '600', fontSize: font.sm, textAlign: 'center' },
  modalChipTxtSelected: { color: colors.bg },
  modalClose: {
    backgroundColor: colors.border, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.md,
  },
  modalCloseTxt: { color: colors.text, fontWeight: '600', fontSize: font.md },
});
