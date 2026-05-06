/**
 * App.js – Root navigation with new linear flow:
 *   Home (profile) → Analysis (body + sport pick) → Diet → Training
 *   Progress tab appears ONLY after the first training session is saved.
 */
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import HomeScreen      from './screens/HomeScreen';
import AnalysisScreen  from './screens/AnalysisScreen';
import DietScreen      from './screens/DietScreen';
import TrainingScreen  from './screens/TrainingScreen';
import ProgressScreen  from './screens/ProgressScreen';

import { colors, font } from './utils/theme';
import { isJourneyComplete } from './utils/storage';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const Icon = ({ emoji, focused }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
  </View>
);

// Hide tab bar on the Home screen; show it everywhere else
const TAB_BAR_VISIBLE = {
  backgroundColor: colors.bg,
  borderTopColor:  colors.border,
  borderTopWidth:  1,
  paddingBottom:   6,
  paddingTop:      6,
  height:          62,
};
const TAB_BAR_HIDDEN = { display: 'none' };

function getTabBarStyle(route) {
  const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';
  return routeName === 'Home' ? TAB_BAR_HIDDEN : TAB_BAR_VISIBLE;
}

// ── Stack for the main journey (Home → Analysis → Diet/Training) ──────────
function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: colors.bg },
        headerTintColor:  colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
        headerBackTitleVisible: false,
        contentStyle:     { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: '🏋️  AI Fitness' }}
      />
      <Stack.Screen
        name="Analysis"
        component={AnalysisScreen}
        options={{ title: '📸  Body Analysis' }}
      />
      <Stack.Screen
        name="Diet"
        component={DietScreen}
        options={({ route }) => ({
          title: `🥗  Diet · ${route.params?.sport || 'Plan'}`,
        })}
      />
      <Stack.Screen
        name="Training"
        component={TrainingScreen}
        options={({ route }) => ({
          title: `🏃  Training · ${route.params?.sport || 'Plan'}`,
        })}
      />
    </Stack.Navigator>
  );
}

// ── Tab root ──────────────────────────────────────────────────────────────
export default function App() {
  const [journeyDone, setJourneyDone] = useState(false);

  useEffect(() => {
    isJourneyComplete().then(done => setJourneyDone(done));
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,   // Stack handles its own headers
          tabBarActiveTintColor:   colors.accent,
          tabBarInactiveTintColor: colors.subtext,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        }}
      >
        <Tab.Screen
          name="Journey"
          component={MainStack}
          options={({ route }) => ({
            title: 'Journey',
            tabBarIcon: ({ focused }) => <Icon emoji="🏠" focused={focused} />,
            tabBarStyle: getTabBarStyle(route),
          })}
        />
        {journeyDone && (
          <Tab.Screen
            name="Progress"
            component={ProgressScreen}
            options={{
              title: 'Progress',
              tabBarIcon: ({ focused }) => <Icon emoji="📊" focused={focused} />,
              headerShown: true,
              headerStyle:      { backgroundColor: colors.bg, borderBottomWidth: 0, elevation: 0 },
              headerTintColor:  colors.text,
              headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
              headerTitle: '📊  Progress',
            }}
          />
        )}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
