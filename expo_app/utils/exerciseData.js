/**
 * exerciseData.js – Centralised exercise metadata & sport→exercise mappings.
 *
 * 13 exercises, 12 sports — as specified.
 */

// ─── 12 Sports → 5 Exercises Each ───────────────────────────────────────────
export const SPORT_EXERCISES = {
  'Football':      ['squat', 'lunge', 'high_knees', 'lateral_shuffle', 'burpee'],
  'Basketball':    ['squat', 'jump_squat', 'high_knees', 'lateral_shuffle', 'pushup'],
  'Cricket':       ['squat', 'lunge', 'overhead_throw', 'lateral_shuffle', 'shoulder_rotation'],
  'Tennis':        ['lunge', 'lateral_shuffle', 'shoulder_rotation', 'arm_circles', 'squat'],
  'Badminton':     ['lunge', 'lateral_shuffle', 'overhead_throw', 'high_knees', 'arm_circles'],
  'Swimming':      ['pushup', 'shoulder_rotation', 'arm_circles', 'forward_bend', 'squat'],
  'Cycling':       ['squat', 'lunge', 'deep_squat', 'forward_bend', 'plank'],
  'Running':       ['squat', 'lunge', 'high_knees', 'forward_bend', 'plank'],
  'Athletics':     ['squat', 'lunge', 'high_knees', 'burpee', 'deep_squat'],
  'Boxing':        ['pushup', 'squat', 'high_knees', 'arm_circles', 'burpee'],
  'Volleyball':    ['jump_squat', 'squat', 'lateral_shuffle', 'overhead_throw', 'plank'],
  'Field Hockey':  ['squat', 'lunge', 'lateral_shuffle', 'overhead_throw', 'deep_squat'],
};

// ─── 13 Exercise Metadata ───────────────────────────────────────────────────
export const EXERCISE_INFO = {
  squat: {
    key: 'squat',
    name: 'Squat',

    type: 'rep',
    muscles: 'Quadriceps · Glutes · Hamstrings · Core',
    instructions: 'Stand with feet shoulder-width apart. Lower your hips back and down. Keep chest up, knees behind toes. Push through heels to stand.',
    benefit: 'Builds explosive lower-body power',
    target_reps: 12,
    difficulty: 'Beginner',
    color: '#00e676',
  },
  pushup: {
    key: 'pushup',
    name: 'Push-up',

    type: 'rep',
    muscles: 'Chest · Triceps · Shoulders · Core',
    instructions: 'Start in plank position. Lower chest to floor by bending elbows. Keep body straight. Push back up.',
    benefit: 'Builds upper-body push strength & stability',
    target_reps: 10,
    difficulty: 'Beginner',
    color: '#4f8ef7',
  },
  lunge: {
    key: 'lunge',
    name: 'Lunge',

    type: 'rep',
    muscles: 'Quadriceps · Glutes · Hamstrings · Hip Flexors',
    instructions: 'Step forward with one leg. Lower until both knees at 90°. Keep torso upright. Push back and alternate.',
    benefit: 'Improves unilateral leg strength & balance',
    target_reps: 10,
    difficulty: 'Beginner',
    color: '#f6e05e',
  },
  plank: {
    key: 'plank',
    name: 'Plank',

    type: 'timer',
    muscles: 'Core · Shoulders · Back · Glutes',
    instructions: 'Support body on forearms and toes. Keep body straight. Engage core. Hold without sagging or piking.',
    benefit: 'Builds core endurance & total body stability',
    target_duration: 30,
    difficulty: 'Beginner',
    color: '#a78bfa',
  },
  burpee: {
    key: 'burpee',
    name: 'Burpee',

    type: 'rep',
    muscles: 'Full Body · Chest · Legs · Core · Cardio',
    instructions: 'Stand → squat → kick back to plank → push-up → jump feet forward → explode up with jump.',
    benefit: 'Ultimate full-body conditioning',
    target_reps: 8,
    difficulty: 'Advanced',
    color: '#fc8181',
  },
  jump_squat: {
    key: 'jump_squat',
    name: 'Jump Squat',

    type: 'rep',
    muscles: 'Quadriceps · Glutes · Calves · Core',
    instructions: 'Squat down, then explode upward into a jump. Land softly with bent knees. Immediately go into next squat.',
    benefit: 'Develops explosive power & plyometric strength',
    target_reps: 10,
    difficulty: 'Intermediate',
    color: '#f97316',
  },
  overhead_throw: {
    key: 'overhead_throw',
    name: 'Overhead Throw',

    type: 'rep',
    muscles: 'Shoulders · Triceps · Core · Back',
    instructions: 'Wind arm back behind head. Drive forward with full arm extension. Focus on controlled follow-through.',
    benefit: 'Builds throwing power & shoulder mobility',
    target_reps: 10,
    difficulty: 'Intermediate',
    color: '#06b6d4',
  },
  deep_squat: {
    key: 'deep_squat',
    name: 'Deep Squat',

    type: 'rep',
    muscles: 'Quadriceps · Glutes · Hip Flexors · Ankles',
    instructions: 'Perform a squat going as deep as possible — hips below knees. Keep heels on ground and back straight.',
    benefit: 'Maximizes leg strength & hip/ankle mobility',
    target_reps: 8,
    difficulty: 'Intermediate',
    color: '#14b8a6',
  },
  high_knees: {
    key: 'high_knees',
    name: 'High Knees',

    type: 'rep',
    muscles: 'Hip Flexors · Quadriceps · Core · Calves',
    instructions: 'Run in place, driving each knee to hip level. Pump arms and maintain quick pace. Keep core tight.',
    benefit: 'Boosts cardiovascular endurance & speed',
    target_reps: 20,
    difficulty: 'Beginner',
    color: '#eab308',
  },
  lateral_shuffle: {
    key: 'lateral_shuffle',
    name: 'Lateral Shuffle',

    type: 'rep',
    muscles: 'Adductors · Abductors · Glutes · Calves',
    instructions: 'Athletic stance. Shuffle sideways with quick steps. Push off with trailing foot. Keep hips low.',
    benefit: 'Develops lateral agility & court movement',
    target_reps: 12,
    difficulty: 'Beginner',
    color: '#8b5cf6',
  },
  arm_circles: {
    key: 'arm_circles',
    name: 'Arm Circles',

    type: 'rep',
    muscles: 'Shoulders · Rotator Cuff · Upper Back',
    instructions: 'Extend arms straight to sides. Make controlled circular motions. Keep arms straight throughout.',
    benefit: 'Warms up shoulders & improves mobility',
    target_reps: 15,
    difficulty: 'Beginner',
    color: '#ec4899',
  },
  shoulder_rotation: {
    key: 'shoulder_rotation',
    name: 'Shoulder Rotation',

    type: 'rep',
    muscles: 'Shoulders · Rotator Cuff · Trapezius',
    instructions: 'Raise arms overhead in controlled motion. Lower back to sides. Focus on full range of motion.',
    benefit: 'Prevents shoulder injuries & improves mobility',
    target_reps: 12,
    difficulty: 'Beginner',
    color: '#22d3ee',
  },
  forward_bend: {
    key: 'forward_bend',
    name: 'Forward Bend',

    type: 'rep',
    muscles: 'Hamstrings · Lower Back · Glutes · Calves',
    instructions: 'Stand with feet hip-width apart. Hinge at hips and fold forward. Keep legs straight. Rise back up slowly.',
    benefit: 'Increases flexibility & spinal decompression',
    target_reps: 10,
    difficulty: 'Beginner',
    color: '#10b981',
  },
};

// ─── Live Tracking Cadence ───────────────────────────────────────────────────
// Smaller numbers mean more frequent frame sampling during live rep tracking.
export const LIVE_TRACKING_INTERVALS_MS = {
  squat: 500,
  deep_squat: 500,
  lunge: 500,
  pushup: 500,
  jump_squat: 350,
  burpee: 350,
  high_knees: 300,
  lateral_shuffle: 350,
  arm_circles: 400,
  shoulder_rotation: 400,
  overhead_throw: 450,
  forward_bend: 600,
  plank: 1000,
};

export const getLiveTrackingInterval = (exerciseKey) => LIVE_TRACKING_INTERVALS_MS[exerciseKey] || 500;

// ─── Difficulty badge colors ────────────────────────────────────────────────
export const DIFFICULTY_COLORS = {
  'Beginner':     '#22c55e',
  'Intermediate': '#eab308',
  'Advanced':     '#ef4444',
};

// ─── 12 Sports (for AnalysisScreen sport picker) ────────────────────────────
export const ALL_SPORTS = Object.keys(SPORT_EXERCISES);

const normalizeSportKey = (sport) => String(sport || '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const SPORT_KEY_LOOKUP = Object.keys(SPORT_EXERCISES).reduce((acc, key) => {
  acc[normalizeSportKey(key)] = key;
  return acc;
}, {});

export const resolveSportKey = (sport) => {
  const normalized = normalizeSportKey(sport);
  return SPORT_KEY_LOOKUP[normalized] || 'Football';
};

export const getSportExercises = (sport) => SPORT_EXERCISES[resolveSportKey(sport)] || SPORT_EXERCISES.Football;

export const formatSportName = (sport) => resolveSportKey(sport);
