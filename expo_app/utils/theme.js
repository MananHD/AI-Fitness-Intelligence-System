// utils/theme.js – Design tokens
import React from 'react';

export const darkTheme = {
  bg:       '#0b1220',
  surface:  '#111a2b',
  surface2: '#162136',
  border:   '#24324b',
  text:     '#edf2f7',
  subtext:  '#93a4bc',
  accent:   '#4f8ff7',
  blue:     '#60a5fa',
  yellow:   '#fbbf24',
  red:      '#ef4444',
  green:    '#22c55e',
};

export const lightTheme = {
  bg:       '#f5f7fb',
  surface:  '#ffffff',
  surface2: '#eef3fb',
  border:   '#dce4f2',
  text:     '#111827',
  subtext:  '#4b5563',
  accent:   '#4f8ff7',
  blue:     '#1d4ed8',
  yellow:   '#f59e0b',
  red:      '#dc2626',
  green:    '#16a34a',
};

export const colors = darkTheme;

export const ThemeContext = React.createContext({
  theme: darkTheme,
  mode: 'dark',
  toggleTheme: () => {},
});

export const useTheme = () => React.useContext(ThemeContext);

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm:  8,
  md:  12,
  lg:  18,
  xl:  24,
};

export const font = {
  sm:   12,
  md:   14,
  lg:   16,
  xl:   20,
  xxl:  24,
};
