import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import HomeScreen        from './screens/HomeScreen';
import ProfileScreen     from './screens/ProfileScreen';
import BodyAnalysisScreen from './screens/BodyAnalysisScreen';
import DietPlanScreen    from './screens/DietPlanScreen';
import ProgressScreen    from './screens/ProgressScreen';

import { colors, font } from './utils/theme';

const Tab = createBottomTabNavigator();

const Icon = ({ emoji, focused }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
  </View>
);

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Tab.Navigator
        screenOptions={{
          headerStyle:      { backgroundColor: colors.bg, borderBottomWidth: 0, elevation: 0 },
          headerTintColor:  colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor:  colors.border,
            borderTopWidth:  1,
            paddingBottom:   6,
            paddingTop:      6,
            height:          62,
          },
          tabBarActiveTintColor:   colors.accent,
          tabBarInactiveTintColor: colors.subtext,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <Icon emoji="🏠" focused={focused} />,
            headerTitle: '🏋️  AI Fitness',
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <Icon emoji="👤" focused={focused} />,
            headerTitle: '👤  Profile',
          }}
        />
        <Tab.Screen
          name="Analysis"
          component={BodyAnalysisScreen}
          options={{
            title: 'Analysis',
            tabBarIcon: ({ focused }) => <Icon emoji="📸" focused={focused} />,
            headerTitle: '📸  Body Analysis',
          }}
        />
        <Tab.Screen
          name="Diet"
          component={DietPlanScreen}
          options={{
            title: 'Diet',
            tabBarIcon: ({ focused }) => <Icon emoji="🥗" focused={focused} />,
            headerTitle: '🥗  Weekly Diet Plan',
          }}
        />
        <Tab.Screen
          name="Progress"
          component={ProgressScreen}
          options={{
            title: 'Progress',
            tabBarIcon: ({ focused }) => <Icon emoji="📊" focused={focused} />,
            headerTitle: '📊  Progress',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
