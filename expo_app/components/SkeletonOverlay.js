/**
 * SkeletonOverlay.js – Draws pose skeleton lines and joint dots
 * over the camera feed during exercise tracking.
 *
 * Receives normalized landmarks (0-1) from the backend and renders
 * them as absolute-positioned Views scaled to the camera dimensions.
 */
import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// Bone connections — matching MediaPipe landmark names
const CONNECTIONS = [
  // Arms
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_ELBOW'],
  ['LEFT_ELBOW', 'LEFT_WRIST'],
  ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
  ['RIGHT_ELBOW', 'RIGHT_WRIST'],
  // Torso
  ['LEFT_SHOULDER', 'LEFT_HIP'],
  ['RIGHT_SHOULDER', 'RIGHT_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],
  // Legs
  ['LEFT_HIP', 'LEFT_KNEE'],
  ['LEFT_KNEE', 'LEFT_ANKLE'],
  ['RIGHT_HIP', 'RIGHT_KNEE'],
  ['RIGHT_KNEE', 'RIGHT_ANKLE'],
];

// Major joints get larger dots
const MAJOR_JOINTS = new Set([
  'LEFT_SHOULDER', 'RIGHT_SHOULDER',
  'LEFT_ELBOW', 'RIGHT_ELBOW',
  'LEFT_WRIST', 'RIGHT_WRIST',
  'LEFT_HIP', 'RIGHT_HIP',
  'LEFT_KNEE', 'RIGHT_KNEE',
  'LEFT_ANKLE', 'RIGHT_ANKLE',
]);

const LINE_COLOR = 'rgba(34, 197, 94, 0.85)';   // Green
const DOT_COLOR = 'rgba(34, 197, 94, 1)';
const DOT_BORDER = 'rgba(255, 255, 255, 0.8)';
const LINE_WIDTH = 3;

function BoneLine({ from, to }) {
  if (!from || !to) return null;

  // Mirror X for front camera (selfie mode)
  const x1 = (1 - from[0]) * SW;
  const y1 = from[1] * SH;
  const x2 = (1 - to[0]) * SW;
  const y2 = to[1] * SH;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <View
      style={{
        position: 'absolute',
        left: x1,
        top: y1,
        width: length,
        height: LINE_WIDTH,
        backgroundColor: LINE_COLOR,
        borderRadius: LINE_WIDTH / 2,
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: 'left center',
        zIndex: 30,
      }}
    />
  );
}

function JointDot({ pos, size = 8 }) {
  if (!pos) return null;

  const x = (1 - pos[0]) * SW;
  const y = pos[1] * SH;

  return (
    <View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: DOT_COLOR,
        borderWidth: 2,
        borderColor: DOT_BORDER,
        zIndex: 31,
      }}
    />
  );
}

export default function SkeletonOverlay({ landmarks, visible = true }) {
  if (!visible || !landmarks) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Draw bones */}
      {CONNECTIONS.map(([a, b], i) => (
        <BoneLine
          key={`bone-${i}`}
          from={landmarks[a]}
          to={landmarks[b]}
        />
      ))}

      {/* Draw joints */}
      {Object.entries(landmarks).map(([name, pos]) => {
        if (!MAJOR_JOINTS.has(name)) return null;
        return (
          <JointDot
            key={`joint-${name}`}
            pos={pos}
            size={name.includes('WRIST') || name.includes('ANKLE') ? 8 : 10}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
  },
});
