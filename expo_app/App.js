/**
 * App.js - Root stack flow:
 * Home -> Analysis -> Final Plan
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import DietScreen from './screens/DietScreen';

import { colors, font } from './utils/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
          headerBackTitleVisible: false,
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
