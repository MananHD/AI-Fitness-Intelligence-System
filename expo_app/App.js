/**
 * App.js - Root stack flow:
 * Home -> Analysis -> Diet -> Training -> Exercise Detail -> Exercise Monitor -> Progress
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors, font } from './utils/theme';
import HomeScreen from './screens/HomeScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import DietScreen from './screens/DietScreen';
import TrainingScreen from './screens/TrainingScreen';
import ProgressScreen from './screens/ProgressScreen';
import ExerciseDetailScreen from './screens/ExerciseDetailScreen';
import ExerciseMonitorScreen from './screens/ExerciseMonitorScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
          headerBackTitleVisible: false,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
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
  );
}
