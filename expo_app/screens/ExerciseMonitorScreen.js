/**
 * ExerciseMonitorScreen.js - Recorded video exercise monitoring.
 * Captures one short video clip, uploads it for analysis, and shows the result.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, radius, font } from '../utils/theme';
import { processFrame, endSession, resetTracker } from '../utils/api';
import { setJourneyComplete } from '../utils/storage';
import { EXERCISE_INFO, getLiveTrackingInterval } from '../utils/exerciseData';
import PositionGuide from '../components/PositionGuide';

const COUNTDOWN_SECONDS = 3;
export default function ExerciseMonitorScreen({ route, navigation }) {
  const { exerciseKey, sessionId, sport } = route.params || {};
  const info = EXERCISE_INFO[exerciseKey] || {};
  const liveFrameIntervalMs = getLiveTrackingInterval(exerciseKey);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const countdownRef = useRef(null);
  const recordingLockRef = useRef(false);
  const elapsedTimerRef = useRef(null);
  const liveAnalysisTimerRef = useRef(null);
  const liveAnalysisBusyRef = useRef(false);
  const liveSessionIdRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [countdown, setCountdown] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [currentStage, setCurrentStage] = useState('READY');
  const [currentFeedback, setFeedback] = useState('Align yourself in the frame');
  const [feedbackLevel, setFeedbackLevel] = useState('info');
  const [correctForm, setCorrectForm] = useState(true);
  const [holdDuration, setHoldDuration] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [liveStatus, setLiveStatus] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionStats, setSessionStats] = useState({});

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
  }, []);

  const clearElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const clearLiveAnalysisTimer = useCallback(() => {
    if (liveAnalysisTimerRef.current) {
      clearInterval(liveAnalysisTimerRef.current);
      liveAnalysisTimerRef.current = null;
    }
  }, []);

  const cleanupTimers = useCallback(() => {
    clearCountdown();
    clearElapsedTimer();
    clearLiveAnalysisTimer();
  }, [clearCountdown, clearElapsedTimer, clearLiveAnalysisTimer]);

  useEffect(() => {
    return () => {
      cleanupTimers();
      try {
        cameraRef.current?.stopRecording?.();
      } catch {
        // Ignore cleanup errors on unmount.
      }
    };
  }, [cleanupTimers]);

  const startLiveTracking = useCallback(async () => {
    if (!cameraRef.current || recordingLockRef.current) return;

    recordingLockRef.current = true;
    setIsRecording(true);
    setFeedback('Tracking reps live...');
    setFeedbackLevel('info');
    setCurrentStage('RECORDING');
    setElapsedTime(0);
    setRepCount(0);
    setHoldDuration(0);
    setConfidence(0);
    setLiveStatus('');

    elapsedTimerRef.current = setInterval(() => {
      setElapsedTime((current) => current + 1);
    }, 1000);

    const liveSessionId = Date.now();
    liveSessionIdRef.current = liveSessionId;

    liveAnalysisTimerRef.current = setInterval(async () => {
      if (!cameraRef.current || !recordingLockRef.current || liveAnalysisBusyRef.current) return;

      liveAnalysisBusyRef.current = true;

      try {
        const snapshot = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.3,
          skipProcessing: true,
          shutterSound: false,
        });

        if (!snapshot?.base64) return;

        const liveResult = await processFrame({
          frame_b64: snapshot.base64,
          exercise: exerciseKey,
          session_id: liveSessionId,
        });

        if (liveResult?.result) {
          const result = liveResult.result;
          setRepCount(result.rep_count || 0);
          setLiveStatus('');
          setCurrentStage(result.stage || 'UNKNOWN');
          setFeedback(result.feedback || 'Tracking your movement...');
          setFeedbackLevel(result.feedback_level || 'info');
          setCorrectForm(result.correct_form !== false);
          setConfidence(result.confidence || 0);
          if (result.hold_duration !== undefined) {
            setHoldDuration(result.hold_duration);
          }
        }
      } catch {
        // Keep trying on the next interval if a snapshot fails.
      } finally {
        liveAnalysisBusyRef.current = false;
      }
    }, liveFrameIntervalMs);

    return null;
  }, [clearCountdown, clearElapsedTimer, exerciseKey, liveFrameIntervalMs, sessionId]);

  const startCountdown = useCallback(() => {
    if (!cameraRef.current || recordingLockRef.current || countdownRef.current) return;

    setFeedback('Get into position. Recording starts shortly.');
    setFeedbackLevel('info');
    setCurrentStage('READY');
    setCountdown(COUNTDOWN_SECONDS);

    let remaining = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdown();
        startLiveTracking();
        return;
      }
      setCountdown(remaining);
    }, 1000);
  }, [clearCountdown, startLiveTracking]);

  const handleStop = async () => {
    if (countdownRef.current) {
      clearCountdown();
      setFeedback('Recording canceled before start.');
      setFeedbackLevel('warning');
      return;
    }

    if (isRecording) {
      clearLiveAnalysisTimer();
      clearElapsedTimer();
      recordingLockRef.current = false;
      setIsRecording(false);
      setCurrentStage('READY');
      setFeedback('Live tracking stopped.');
      setFeedbackLevel('info');

      if (sessionId) {
        await endSession(sessionId, { total_reps: repCount });
        try {
          await resetTracker(sessionId);
        } catch (cleanupError) {
          console.warn('Tracker cleanup failed:', cleanupError);
        }
      }

      await setJourneyComplete();
      setSessionStats({
        exercise: info.name,
        reps: repCount,
        duration: elapsedTime,
        holdDuration,
        framesSampled: 0,
      });
      setShowSummary(true);
    }
  };

  const toggleCameraFacing = () => {
    if (isRecording) return;
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const handleFinish = () => {
    setShowSummary(false);
    navigation.goBack();
    navigation.goBack();
  };

  const handleStart = () => {
    if (isRecording) return;
    startCountdown();
  };

  if (!permission) {
    return (
      <View style={s.container}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.container}>
        <View style={s.permCard}>
          <View style={s.permIcon}>
            <Text style={s.permIconTxt}>Camera</Text>
          </View>
          <Text style={s.permTitle}>Camera Access Required</Text>
          <Text style={s.permTxt}>
            We need camera access to track your reps live while you exercise.
          </Text>
          <TouchableOpacity
            style={s.permBtn}
            onPress={async () => {
              await requestPermission();
            }}
          >
            <Text style={s.permBtnTxt}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const feedbackColor =
    feedbackLevel === 'error' ? colors.red :
    feedbackLevel === 'warning' ? colors.yellow :
    colors.green;

  const stageColor =
    currentStage === 'UP' || currentStage === 'STAND' ? colors.green :
    currentStage === 'DOWN' || currentStage === 'SQUAT' ? colors.accent :
    currentStage === 'HOLD' || currentStage === 'PLANK' ? '#a78bfa' :
    currentStage === 'RECORDING' ? colors.blue :
    colors.subtext;

  const isTimer = info.type === 'timer';
  const displayValue = isTimer ? `${Math.floor(holdDuration)}s` : repCount;
  const displayLabel = isTimer ? 'HOLD TIME' : 'REPS';
  const showGuide = !isRecording;

  return (
    <View style={s.container}>
      <CameraView
        ref={cameraRef}
        style={s.camera}
        facing={cameraFacing}
        mode="picture"
        animateShutter={false}
        flash="off"
        onCameraReady={() => setCameraReady(true)}
      >
        <PositionGuide visible={showGuide} />

        <View style={s.cameraSwitchWrap}>
          <Text style={s.cameraSwitchLabel}>Camera Side</Text>
          <TouchableOpacity
            style={[s.cameraSwitchBtn, isRecording && s.cameraSwitchBtnDisabled]}
            onPress={toggleCameraFacing}
            disabled={isRecording}
          >
            <Text style={s.cameraSwitchBtnTxt}>
              {cameraFacing === 'back' ? 'Use Front Camera' : 'Use Back Camera'}
            </Text>
          </TouchableOpacity>
        </View>

        {isRecording ? (
          <>
            <View style={s.topOverlayRecording}>
              <View style={s.exerciseBadge}>
                <Text style={s.exerciseBadgeTxt}>{info.name || 'Exercise'}</Text>
              </View>
              <View style={s.confidenceBadge}>
                <View style={[s.confidenceDot, { backgroundColor: confidence > 0.5 ? colors.green : colors.red }]} />
                <Text style={s.confidenceTxt}>{confidence > 0.5 ? 'Tracking' : 'Waiting'}</Text>
              </View>
            </View>

            <View style={s.centerOverlay}>
              <View style={s.liveStatsCard}>
                <Text style={s.liveStatsLabel}>{displayLabel}</Text>
                <Text style={s.liveStatsValue}>{displayValue}</Text>
                {liveStatus ? <Text style={s.liveStatsNote}>{liveStatus}</Text> : null}
              </View>

              <View style={s.statusBadge}>
                <View style={s.liveDot} />
                <Text style={s.statusTxt}>Tracking live reps</Text>
              </View>
            </View>
          </>
        ) : null}

        <View style={s.bottomOverlay}>
          {!isRecording ? (
            <TouchableOpacity style={s.startBtn} onPress={handleStart}>
              <Text style={s.startBtnTxt}>Start Exercise</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={s.stageRow}>
                <View style={[s.stageBadge, { backgroundColor: stageColor }]}>
                  <Text style={s.stageTxt}>{currentStage}</Text>
                </View>
                <Text style={s.timerTxt}>
                  {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
                </Text>
              </View>

              <View style={[s.feedbackBar, { borderColor: feedbackColor }]}>
                <View style={[s.feedbackDot, { backgroundColor: correctForm ? colors.green : colors.red }]} />
                <Text style={[s.feedbackTxt, { color: feedbackColor }]}>{currentFeedback}</Text>
              </View>

              <TouchableOpacity style={s.stopBtn} onPress={handleStop} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.stopBtnTxt}>Stop Exercise</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </CameraView>

      <Modal visible={showSummary} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.summaryCard}>
            <View style={s.checkCircle}>
              <Text style={s.checkMark}>✓</Text>
            </View>
            <Text style={s.summaryTitle}>Session Complete</Text>
            <Text style={s.summaryExercise}>{sessionStats.exercise}</Text>

            <View style={s.summaryMetrics}>
              <View style={s.summaryMetric}>
                <Text style={s.summaryMetricVal}>{isTimer ? `${Math.floor(sessionStats.holdDuration || 0)}s` : sessionStats.reps}</Text>
                <Text style={s.summaryMetricLabel}>{isTimer ? 'HOLD TIME' : 'TOTAL REPS'}</Text>
              </View>
              <View style={s.summaryMetric}>
                <Text style={s.summaryMetricVal}>
                  {Math.floor((sessionStats.duration || 0) / 60)}:{String((sessionStats.duration || 0) % 60).padStart(2, '0')}
                </Text>
                <Text style={s.summaryMetricLabel}>DURATION</Text>
              </View>
            </View>

            <Text style={s.summaryHint}>Video analyzed and saved to your progress tracker</Text>

            <TouchableOpacity style={s.summaryBtn} onPress={handleFinish}>
              <Text style={s.summaryBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  topOverlayRecording: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 60, zIndex: 20 },
  exerciseBadge: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  exerciseBadgeTxt: { color: '#fff', fontWeight: '700', fontSize: font.md },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  confidenceDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  confidenceTxt: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  cameraSwitchWrap: { alignSelf: 'flex-start', marginLeft: spacing.md, marginTop: spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, zIndex: 20 },
  cameraSwitchLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  cameraSwitchBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  cameraSwitchBtnDisabled: { opacity: 0.55 },
  cameraSwitchBtnTxt: { color: '#fff', fontSize: font.sm, fontWeight: '800' },
  centerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  liveStatsCard: { minWidth: 170, borderRadius: radius.lg, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginBottom: spacing.md },
  liveStatsLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  liveStatsValue: { color: '#fff', fontSize: 40, fontWeight: '900', marginTop: 2 },
  liveStatsNote: { color: colors.yellow, fontSize: font.xs, fontWeight: '600', marginTop: spacing.xs, textAlign: 'center' },
  statusBadge: { minWidth: 180, minHeight: 140, borderRadius: radius.lg, backgroundColor: 'rgba(17, 24, 39, 0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.lg },
  statusTxt: { color: '#fff', fontSize: font.md, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' },
  liveDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', marginBottom: spacing.sm },
  bottomOverlay: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, zIndex: 20 },
  stageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  stageBadge: { borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  stageTxt: { color: '#fff', fontWeight: '800' },
  timerTxt: { color: '#fff', fontSize: font.lg, fontWeight: '700' },
  feedbackBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, marginBottom: spacing.sm },
  feedbackDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  feedbackTxt: { flex: 1, fontSize: font.sm, fontWeight: '600' },
  startBtn: { backgroundColor: colors.green, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  startBtnTxt: { color: '#fff', fontWeight: '800', fontSize: font.lg },
  stopBtn: { backgroundColor: colors.red, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  stopBtnTxt: { color: '#fff', fontWeight: '800', fontSize: font.lg },
  permCard: { margin: spacing.lg, marginTop: 120, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  permIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  permIconTxt: { color: colors.bg, fontSize: font.xl, fontWeight: '900' },
  permTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800', marginBottom: spacing.sm },
  permTxt: { color: colors.subtext, fontSize: font.md, textAlign: 'center', lineHeight: 22, marginBottom: spacing.md },
  permBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  permBtnTxt: { color: colors.bg, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  summaryCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  checkCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  checkMark: { color: '#fff', fontSize: font.xl, fontWeight: '900' },
  summaryTitle: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  summaryExercise: { color: colors.accent, fontSize: font.lg, fontWeight: '700', marginBottom: spacing.md },
  summaryMetrics: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  summaryMetric: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  summaryMetricVal: { color: colors.text, fontSize: font.xl, fontWeight: '900' },
  summaryMetricLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', marginTop: 2 },
  summaryHint: { color: colors.subtext, textAlign: 'center', marginBottom: spacing.md },
  summaryBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', width: '100%' },
  summaryBtnTxt: { color: colors.bg, fontWeight: '800', fontSize: font.md },
});
