// utils/storage.js – AsyncStorage helpers for persisting user session
import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveUser = async (user) => {
  await AsyncStorage.setItem('user', JSON.stringify(user));
};

export const loadUser = async () => {
  const raw = await AsyncStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
};

export const clearUser = async () => {
  await AsyncStorage.removeItem('user');
};

export const setJourneyComplete = async () => {
  await AsyncStorage.setItem('journeyComplete', 'true');
};

export const isJourneyComplete = async () => {
  const val = await AsyncStorage.getItem('journeyComplete');
  return val === 'true';
};
