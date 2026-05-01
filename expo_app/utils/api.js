// utils/api.js – All FastAPI backend calls

// ── IMPORTANT: Change this to your PC's local IP when testing on phone ─────
export const API_BASE = 'http://192.168.1.9:8000/api';

const req = async (method, path, body) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
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

// Sessions
export const startSession = (data) => req('POST', '/sessions/start', data);
export const endSession = (id, data) => req('POST', `/sessions/${id}/end`, data);

// Progress
export const getProgress = (userId) => req('GET', `/progress/${userId}`);

// Health
export const healthCheck = () => req('GET', '/health');
