/**
 * ExerciseDemoAnimation.js – Animated stick-figure exercise demo.
 * Loops a 2-keyframe animation showing the exercise movement pattern.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

// ─── Joint positions for each exercise at START and END keyframes ────────────
// Coordinates are relative to a 120x200 bounding box (center = 60, 100)
// Format: { head, shoulders, elbowL, elbowR, handL, handR, hip, kneeL, kneeR, footL, footR }

const POSES = {
  squat: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[30,60], elbowR:[90,60], handL:[25,50], handR:[95,50], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,50], shoulderL:[40,70], shoulderR:[80,70], elbowL:[28,82], elbowR:[92,82], handL:[22,72], handR:[98,72], hip:[60,105], kneeL:[35,130], kneeR:[85,130], footL:[38,160], footR:[82,160] },
  },
  pushup: {
    start: { head:[25,60], shoulderL:[40,70], shoulderR:[40,70], elbowL:[35,90], elbowR:[45,90], handL:[30,110], handR:[50,110], hip:[70,75], kneeL:[90,80], kneeR:[90,80], footL:[110,85], footR:[110,85] },
    end:   { head:[25,80], shoulderL:[40,88], shoulderR:[40,88], elbowL:[25,100], elbowR:[55,100], handL:[30,110], handR:[50,110], hip:[70,90], kneeL:[90,92], kneeR:[90,92], footL:[110,95], footR:[110,95] },
  },
  lunge: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[35,65], elbowR:[85,65], handL:[35,55], handR:[85,55], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,30], shoulderL:[45,50], shoulderR:[75,50], elbowL:[40,70], elbowR:[80,70], handL:[40,60], handR:[80,60], hip:[60,90], kneeL:[35,125], kneeR:[85,110], footL:[30,160], footR:[90,160] },
  },
  plank: {
    start: { head:[20,65], shoulderL:[35,72], shoulderR:[35,72], elbowL:[30,95], elbowR:[40,95], handL:[28,110], handR:[42,110], hip:[65,75], kneeL:[85,78], kneeR:[85,78], footL:[105,82], footR:[105,82] },
    end:   { head:[20,65], shoulderL:[35,72], shoulderR:[35,72], elbowL:[30,95], elbowR:[40,95], handL:[28,110], handR:[42,110], hip:[65,75], kneeL:[85,78], kneeR:[85,78], footL:[105,82], footR:[105,82] },
  },
  burpee: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[30,35], elbowR:[90,35], handL:[25,25], handR:[95,25], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,50], shoulderL:[40,70], shoulderR:[80,70], elbowL:[28,82], elbowR:[92,82], handL:[22,72], handR:[98,72], hip:[60,105], kneeL:[35,130], kneeR:[85,130], footL:[38,160], footR:[82,160] },
  },
  jump_squat: {
    start: { head:[60,50], shoulderL:[40,70], shoulderR:[80,70], elbowL:[28,82], elbowR:[92,82], handL:[22,72], handR:[98,72], hip:[60,105], kneeL:[35,130], kneeR:[85,130], footL:[38,160], footR:[82,160] },
    end:   { head:[60,10], shoulderL:[40,35], shoulderR:[80,35], elbowL:[25,25], elbowR:[95,25], handL:[20,15], handR:[100,15], hip:[60,75], kneeL:[42,100], kneeR:[78,100], footL:[38,140], footR:[82,140] },
  },
  overhead_throw: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[35,65], elbowR:[85,28], handL:[35,55], handR:[88,12], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,22], shoulderL:[40,45], shoulderR:[80,45], elbowL:[35,65], elbowR:[95,65], handL:[35,55], handR:[105,80], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
  },
  deep_squat: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[28,60], elbowR:[92,60], handL:[22,50], handR:[98,50], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,60], shoulderL:[40,80], shoulderR:[80,80], elbowL:[25,92], elbowR:[95,92], handL:[20,82], handR:[100,82], hip:[60,115], kneeL:[30,140], kneeR:[90,140], footL:[38,160], footR:[82,160] },
  },
  high_knees: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[30,60], elbowR:[90,60], handL:[35,50], handR:[85,50], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,18], shoulderL:[40,43], shoulderR:[80,43], elbowL:[32,55], elbowR:[88,62], handL:[37,48], handR:[83,52], hip:[60,83], kneeL:[40,85], kneeR:[78,120], footL:[42,110], footR:[82,160] },
  },
  lateral_shuffle: {
    start: { head:[60,25], shoulderL:[40,50], shoulderR:[80,50], elbowL:[28,65], elbowR:[92,65], handL:[25,55], handR:[95,55], hip:[60,90], kneeL:[38,122], kneeR:[82,122], footL:[30,160], footR:[90,160] },
    end:   { head:[75,25], shoulderL:[55,50], shoulderR:[95,50], elbowL:[43,65], elbowR:[107,65], handL:[40,55], handR:[110,55], hip:[75,90], kneeL:[55,122], kneeR:[95,122], footL:[48,160], footR:[102,160] },
  },
  arm_circles: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[20,45], elbowR:[100,45], handL:[8,45], handR:[112,45], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[35,25], elbowR:[85,25], handL:[40,8], handR:[80,8], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
  },
  shoulder_rotation: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[35,65], elbowR:[85,65], handL:[35,50], handR:[85,50], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[30,30], elbowR:[90,30], handL:[35,12], handR:[85,12], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
  },
  forward_bend: {
    start: { head:[60,20], shoulderL:[40,45], shoulderR:[80,45], elbowL:[35,65], elbowR:[85,65], handL:[35,55], handR:[85,55], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
    end:   { head:[60,80], shoulderL:[45,85], shoulderR:[75,85], elbowL:[40,105], elbowR:[80,105], handL:[38,130], handR:[82,130], hip:[60,85], kneeL:[42,120], kneeR:[78,120], footL:[38,160], footR:[82,160] },
  },
};

// Interpolate between two values
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpolate between two pose keyframes
function lerpPose(start, end, t) {
  const result = {};
  for (const key of Object.keys(start)) {
    result[key] = [
      lerp(start[key][0], end[key][0], t),
      lerp(start[key][1], end[key][1], t),
    ];
  }
  return result;
}

// ─── Stick Figure Renderer ───────────────────────────────────────────────────
const StickLine = ({ from, to, color = '#22c55e', width = 2.5 }) => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <View
      style={{
        position: 'absolute',
        left: from[0],
        top: from[1],
        width: length,
        height: width,
        backgroundColor: color,
        borderRadius: width / 2,
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: 'left center',
      }}
    />
  );
};

const StickJoint = ({ pos, size = 5, color = '#22c55e' }) => (
  <View
    style={{
      position: 'absolute',
      left: pos[0] - size / 2,
      top: pos[1] - size / 2,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
    }}
  />
);

const StickFigure = ({ pose, color = '#22c55e' }) => {
  if (!pose) return null;
  const p = pose;

  // Define bone connections
  const bones = [
    // Spine
    [p.head, p.shoulderL], [p.head, p.shoulderR],
    [p.shoulderL, p.shoulderR],
    // Left arm
    [p.shoulderL, p.elbowL], [p.elbowL, p.handL],
    // Right arm
    [p.shoulderR, p.elbowR], [p.elbowR, p.handR],
    // Torso
    [p.shoulderL, p.hip], [p.shoulderR, p.hip],
    // Left leg
    [p.hip, p.kneeL], [p.kneeL, p.footL],
    // Right leg
    [p.hip, p.kneeR], [p.kneeR, p.footR],
  ];

  // Define joints
  const joints = [
    { pos: p.head, size: 12 },
    { pos: p.shoulderL, size: 5 }, { pos: p.shoulderR, size: 5 },
    { pos: p.elbowL, size: 4 }, { pos: p.elbowR, size: 4 },
    { pos: p.handL, size: 4 }, { pos: p.handR, size: 4 },
    { pos: p.hip, size: 6 },
    { pos: p.kneeL, size: 5 }, { pos: p.kneeR, size: 5 },
    { pos: p.footL, size: 4 }, { pos: p.footR, size: 4 },
  ];

  return (
    <View style={{ width: 120, height: 170 }}>
      {bones.map((b, i) => (
        <StickLine key={`b${i}`} from={b[0]} to={b[1]} color={color} />
      ))}
      {joints.map((j, i) => (
        <StickJoint key={`j${i}`} pos={j.pos} size={j.size} color={color} />
      ))}
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ExerciseDemoAnimation({ exerciseKey, color = '#22c55e', size = 1.0 }) {
  const animValue = useRef(new Animated.Value(0)).current;

  const poseData = POSES[exerciseKey] || POSES.squat;
  const isStatic = exerciseKey === 'plank'; // Plank is a hold — no animation

  useEffect(() => {
    if (isStatic) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [exerciseKey]);

  // For static poses, just render the start pose
  if (isStatic) {
    return (
      <View style={[styles.container, { transform: [{ scale: size }] }]}>
        <StickFigure pose={poseData.start} color={color} />
      </View>
    );
  }

  return (
    <AnimatedStickFigure
      animValue={animValue}
      startPose={poseData.start}
      endPose={poseData.end}
      color={color}
      size={size}
    />
  );
}

// Wrapper that listens to animated value and re-renders stick figure
function AnimatedStickFigure({ animValue, startPose, endPose, color, size }) {
  const [t, setT] = React.useState(0);

  useEffect(() => {
    const id = animValue.addListener(({ value }) => setT(value));
    return () => animValue.removeListener(id);
  }, [animValue]);

  const currentPose = lerpPose(startPose, endPose, t);

  return (
    <View style={[styles.container, { transform: [{ scale: size }] }]}>
      <StickFigure pose={currentPose} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
