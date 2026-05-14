/**
 * PositionGuide.js – Green body outline overlay for camera positioning.
 * Shows where the user should stand before exercise tracking starts.
 * Fades out when tracking begins.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// Guide dimensions relative to screen
const GUIDE_W = SW * 0.56;
const GUIDE_H = SH * 0.72;
const GUIDE_X = (SW - GUIDE_W) / 2;
const GUIDE_Y = SH * 0.08;

const GUIDE_COLOR = 'rgba(34, 197, 94, 0.6)';  // Green with transparency
const LINE_WIDTH = 3;

// Body proportions (relative to GUIDE_H)
const HEAD_Y = 0.04;
const HEAD_R = GUIDE_W * 0.11;
const SHOULDER_Y = 0.17;
const SHOULDER_SPAN = 0.7;
const HIP_Y = 0.46;
const HIP_SPAN = 0.38;
const KNEE_Y = 0.73;
const KNEE_SPAN = 0.34;
const FOOT_Y = 0.95;
const FOOT_SPAN = 0.34;
const HAND_Y = 0.4;
const HAND_SPAN = 0.9;
const ELBOW_Y = 0.3;
const ELBOW_SPAN = 0.82;

const GuideCircle = ({ cx, cy, r }) => (
  <View style={{
    position: 'absolute',
    left: cx - r,
    top: cy - r,
    width: r * 2,
    height: r * 2,
    borderRadius: r,
    borderWidth: LINE_WIDTH,
    borderColor: GUIDE_COLOR,
  }} />
);

const GuideLine = ({ x1, y1, x2, y2 }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <View style={{
      position: 'absolute',
      left: x1,
      top: y1,
      width: length,
      height: LINE_WIDTH,
      backgroundColor: GUIDE_COLOR,
      transform: [{ rotate: `${angle}deg` }],
      transformOrigin: 'left center',
    }} />
  );
};

const GuideDot = ({ cx, cy, r = 4 }) => (
  <View style={{
    position: 'absolute',
    left: cx - r,
    top: cy - r,
    width: r * 2,
    height: r * 2,
    borderRadius: r,
    backgroundColor: GUIDE_COLOR,
  }} />
);

export default function PositionGuide({ visible = true }) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // Gentle pulse animation
  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.98, duration: 1500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible]);

  // Compute body landmarks
  const cx = GUIDE_W / 2;

  const head = { x: cx, y: GUIDE_H * HEAD_Y };
  const shoulderL = { x: cx - (GUIDE_W * SHOULDER_SPAN) / 2, y: GUIDE_H * SHOULDER_Y };
  const shoulderR = { x: cx + (GUIDE_W * SHOULDER_SPAN) / 2, y: GUIDE_H * SHOULDER_Y };
  const elbowL = { x: cx - (GUIDE_W * ELBOW_SPAN) / 2, y: GUIDE_H * ELBOW_Y };
  const elbowR = { x: cx + (GUIDE_W * ELBOW_SPAN) / 2, y: GUIDE_H * ELBOW_Y };
  const handL = { x: cx - (GUIDE_W * HAND_SPAN) / 2, y: GUIDE_H * HAND_Y };
  const handR = { x: cx + (GUIDE_W * HAND_SPAN) / 2, y: GUIDE_H * HAND_Y };
  const hipL = { x: cx - (GUIDE_W * HIP_SPAN) / 2, y: GUIDE_H * HIP_Y };
  const hipR = { x: cx + (GUIDE_W * HIP_SPAN) / 2, y: GUIDE_H * HIP_Y };
  const kneeL = { x: cx - (GUIDE_W * KNEE_SPAN) / 2, y: GUIDE_H * KNEE_Y };
  const kneeR = { x: cx + (GUIDE_W * KNEE_SPAN) / 2, y: GUIDE_H * KNEE_Y };
  const footL = { x: cx - (GUIDE_W * FOOT_SPAN) / 2, y: GUIDE_H * FOOT_Y };
  const footR = { x: cx + (GUIDE_W * FOOT_SPAN) / 2, y: GUIDE_H * FOOT_Y };

  return (
    <Animated.View style={[styles.overlay, { opacity, transform: [{ scale: pulse }] }]} pointerEvents="none">
      <View style={[styles.guideBox, { left: GUIDE_X, top: GUIDE_Y, width: GUIDE_W, height: GUIDE_H }]}>

        {/* Dashed border zone */}
        <View style={styles.zoneBorder} />

        {/* Head */}
        <GuideCircle cx={head.x} cy={head.y} r={HEAD_R} />

        {/* Neck to shoulders */}
        <GuideLine x1={head.x} y1={head.y + HEAD_R} x2={shoulderL.x} y2={shoulderL.y} />
        <GuideLine x1={head.x} y1={head.y + HEAD_R} x2={shoulderR.x} y2={shoulderR.y} />

        {/* Shoulders */}
        <GuideLine x1={shoulderL.x} y1={shoulderL.y} x2={shoulderR.x} y2={shoulderR.y} />

        {/* Arms */}
        <GuideLine x1={shoulderL.x} y1={shoulderL.y} x2={elbowL.x} y2={elbowL.y} />
        <GuideLine x1={elbowL.x} y1={elbowL.y} x2={handL.x} y2={handL.y} />
        <GuideLine x1={shoulderR.x} y1={shoulderR.y} x2={elbowR.x} y2={elbowR.y} />
        <GuideLine x1={elbowR.x} y1={elbowR.y} x2={handR.x} y2={handR.y} />

        {/* Torso */}
        <GuideLine x1={shoulderL.x} y1={shoulderL.y} x2={hipL.x} y2={hipL.y} />
        <GuideLine x1={shoulderR.x} y1={shoulderR.y} x2={hipR.x} y2={hipR.y} />
        <GuideLine x1={hipL.x} y1={hipL.y} x2={hipR.x} y2={hipR.y} />

        {/* Legs */}
        <GuideLine x1={hipL.x} y1={hipL.y} x2={kneeL.x} y2={kneeL.y} />
        <GuideLine x1={kneeL.x} y1={kneeL.y} x2={footL.x} y2={footL.y} />
        <GuideLine x1={hipR.x} y1={hipR.y} x2={kneeR.x} y2={kneeR.y} />
        <GuideLine x1={kneeR.x} y1={kneeR.y} x2={footR.x} y2={footR.y} />

        {/* Joint dots */}
        <GuideDot cx={shoulderL.x} cy={shoulderL.y} />
        <GuideDot cx={shoulderR.x} cy={shoulderR.y} />
        <GuideDot cx={elbowL.x} cy={elbowL.y} r={3} />
        <GuideDot cx={elbowR.x} cy={elbowR.y} r={3} />
        <GuideDot cx={handL.x} cy={handL.y} r={3} />
        <GuideDot cx={handR.x} cy={handR.y} r={3} />
        <GuideDot cx={hipL.x} cy={hipL.y} />
        <GuideDot cx={hipR.x} cy={hipR.y} />
        <GuideDot cx={kneeL.x} cy={kneeL.y} />
        <GuideDot cx={kneeR.x} cy={kneeR.y} />
        <GuideDot cx={footL.x} cy={footL.y} r={3} />
        <GuideDot cx={footR.x} cy={footR.y} r={3} />
      </View>

      {/* Label */}
      <View style={[styles.labelBox, { top: GUIDE_Y + GUIDE_H + 16 }]}>
        <Text style={styles.labelTxt}>Align your body within the outline</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  guideBox: {
    position: 'absolute',
  },
  zoneBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  labelBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  labelTxt: {
    color: 'rgba(34, 197, 94, 0.8)',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
