/**
 * App.js - Root stack flow:
 * Home -> Analysis -> Diet -> Training -> Exercise Detail -> Exercise Monitor -> Progress
 */
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkTheme, lightTheme, ThemeContext, font } from './utils/theme';
import HomeScreen from './screens/HomeScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import DietScreen from './screens/DietScreen';
import TrainingScreen from './screens/TrainingScreen';
import ProgressScreen from './screens/ProgressScreen';
import ExerciseDetailScreen from './screens/ExerciseDetailScreen';
import ExerciseMonitorScreen from './screens/ExerciseMonitorScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [mode, setMode] = useState('dark');
  const [theme, setTheme] = useState(darkTheme);

  useEffect(() => {
    const restoreTheme = async () => {
      const stored = await AsyncStorage.getItem('appTheme');
      if (stored === 'light' || stored === 'dark') {
        setMode(stored);
        setTheme(stored === 'light' ? lightTheme : darkTheme);
      }
    };
    restoreTheme();
  }, []);

  const toggleTheme = async () => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
    setTheme(nextMode === 'dark' ? darkTheme : lightTheme);
    await AsyncStorage.setItem('appTheme', nextMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
      <NavigationContainer>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor={theme.bg} />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
            headerBackTitleVisible: false,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'AI Fitness' }} />
        <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ title: 'Body Analysis' }} />
        <Stack.Screen
          name="Diet"
          component={DietScreen}
          options={({ route }) => ({ title: `Final Plan · ${route.params?.sport || 'Sport'}` })}
        />
        <Stack.Screen
          name="Training"
          component={TrainingScreen}
          options={{ title: 'Training' }}
        />
        <Stack.Screen
          name="ExerciseDetail"
          component={ExerciseDetailScreen}
          options={{ title: 'Exercise Details' }}
        />
        <Stack.Screen
          name="ExerciseMonitor"
          component={ExerciseMonitorScreen}
          options={{ title: 'AI Monitor', headerShown: false }}
        />
        <Stack.Screen
          name="Progress"
          component={ProgressScreen}
          options={{ title: 'Progress' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </ThemeContext.Provider>
  );
}
