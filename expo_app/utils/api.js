// utils/api.js – All FastAPI backend calls
import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

// Environment variables (set via .env in project root):
//   EXPO_PUBLIC_API_HOST=192.168.x.x (your machine's local IP)
//   EXPO_PUBLIC_API_PORT=8000 (optional, defaults to 8000)
const API_PORT =
  process.env.EXPO_PUBLIC_API_PORT ||
  Constants?.expoConfig?.extra?.apiPort ||
  '8000';
const REQUEST_TIMEOUT_MS = 120000;
const FALLBACK_HOSTS = [];

const parseHostFromScriptURL = () => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (!scriptURL) return null;
    return new URL(scriptURL).hostname;
  } catch {
    return null;
  }
};

const parseHostFromExpoConstants = () => {
  try {
    const extraHost = Constants?.expoConfig?.extra?.apiHost;
    if (typeof extraHost === 'string' && extraHost.trim()) {
      return extraHost.trim();
    }

    const candidates = [
      Constants?.expoConfig?.hostUri,
      Constants?.manifest?.debuggerHost,
      Constants?.manifest2?.extra?.expoClient?.hostUri,
    ];

    for (const value of candidates) {
      if (!value || typeof value !== 'string') continue;
      const host = value.split(':')[0];
      if (host) return host;
    }
  } catch {
    return null;
  }
  return null;
};

const getCandidateHosts = () => {
  const envHost = process.env.EXPO_PUBLIC_API_HOST;
  const metroHost = parseHostFromScriptURL();
  const expoHost = parseHostFromExpoConstants();
  const hosts = [];

  // Highest priority: explicit host provided via environment variable
  if (envHost && envHost.trim()) {
    hosts.push(envHost.trim());
  }

  // Add fallback hosts for common LAN IP ranges
  hosts.push(...FALLBACK_HOSTS);

  // In Expo dev, try to extract from Metro bundle host
  if (metroHost) hosts.push(metroHost);
  if (expoHost) hosts.push(expoHost);

  // Platform-specific fallbacks
  if (Platform.OS === 'android') {
    hosts.push('10.0.2.2'); // Android emulator -> host machine
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    hosts.push(window.location.hostname || 'localhost');
  }

  hosts.push('127.0.0.1');
  hosts.push('localhost');

  // Remove duplicates while preserving order
  return [...new Set(hosts.filter(Boolean))];
};

let lastWorkingHost = process.env.EXPO_PUBLIC_API_HOST || null;

const makeApiBase = (host) => `http://${host}:${API_PORT}/api`;
export const API_BASE = makeApiBase(lastWorkingHost || getCandidateHosts()[0] || '127.0.0.1');

const fetchWithTimeout = async (url, opts) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const req = async (method, path, body) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const hosts = lastWorkingHost
    ? [lastWorkingHost, ...getCandidateHosts().filter(h => h !== lastWorkingHost)]
    : getCandidateHosts();

  let lastNetworkError = null;
  for (const host of hosts) {
    const base = makeApiBase(host);
    try {
      const res = await fetchWithTimeout(`${base}${path}`, opts);
      if (!res.ok) {
        // Reachable backend responded; do not continue fallback hosts.
        throw new Error(`API ${res.status}: ${path}`);
      }
      lastWorkingHost = host;
      return res.json();
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Network request failed') {
        lastNetworkError = err;
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `Cannot reach backend. Tried: ${hosts.map(h => makeApiBase(h)).join(', ')}. ` +
    `Last error: ${lastNetworkError?.message || 'timeout'}`
  );
};

// Users
export const createUser = (data) => req('POST', '/users', data);
export const getUser = (id) => req('GET', `/users/${id}`);
export const listUsers = () => req('GET', '/users');
export const getUserSummary = (id) => req('GET', `/users/${id}/summary`);

// Analysis
export const analyzeBody = (data) => req('POST', '/analyze-body', data);
export const recommendSport = (data) => req('POST', '/recommend-sport', data);
export const recommendDiet = (data) => req('POST', '/recommend-diet', data);
export const predictSportPhysical = (data) => req('POST', '/predict-sport-physical', data);
export const getPhysicalModelStatus = () => req('GET', '/predict-sport-physical/status');

// Sessions
export const startSession = (data) => req('POST', '/sessions/start', data);
export const endSession = (id, data) => req('POST', `/sessions/${id}/end`, data);

// Progress
export const getProgress = (userId) => req('GET', `/progress/${userId}`);

// Health
export const healthCheck = () => req('GET', '/health');

// Exercise Monitoring
export const processFrame = (data) => req('POST', '/exercise/process-frame', data);
export const processVideo = async ({ uri, exercise, sessionId = 0, name = 'exercise.mp4', type = 'video/mp4' }) => {
  const formData = new FormData();
  formData.append('exercise', exercise);
  formData.append('session_id', String(sessionId));
  formData.append('video_file', { uri, name, type });

  const hosts = lastWorkingHost
    ? [lastWorkingHost, ...getCandidateHosts().filter(h => h !== lastWorkingHost)]
    : getCandidateHosts();

  let lastNetworkError = null;
  for (const host of hosts) {
    const base = makeApiBase(host);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(`${base}/exercise/process-video`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`API ${res.status}: /exercise/process-video`);
        }

        lastWorkingHost = host;
        return res.json();
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Network request failed') {
        lastNetworkError = err;
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `Cannot reach backend. Tried: ${hosts.map(h => makeApiBase(h)).join(', ')}. ` +
    `Last error: ${lastNetworkError?.message || 'timeout'}`
  );
};
export const getSportsMapping = () => req('GET', '/exercise/sports-mapping');
export const getExerciseInfo = (key) => req('GET', `/exercise/info/${key}`);
export const listExercises = () => req('GET', '/exercise/list');
export const resetTracker = (sessionId) => req('POST', `/exercise/reset-tracker/${sessionId}`);
