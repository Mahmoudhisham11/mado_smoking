'use client';

import { useTheme } from '../contexts/ThemeContext';

// Theme colors for dark and light modes
const darkTheme = {
  primaryColor: '#22c55e',
  backgroundColor: '#0f0f0f',
  cardColor: '#1a1a1a',
  textPrimary: '#ffffff',
  textSecondary: '#a3a3a3',
  borderRadius: '12px',
};

const lightTheme = {
  primaryColor: '#22c55e',
  backgroundColor: '#ffffff',
  cardColor: '#f5f5f5',
  textPrimary: '#1a1a1a',
  textSecondary: '#6b7280',
  borderRadius: '12px',
};

// Hook to get current theme colors
export function useThemeColors() {
  const { resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme === 'light' ? lightTheme : darkTheme;

  return {
    primary: currentTheme.primaryColor,
    background: currentTheme.backgroundColor,
    card: currentTheme.cardColor,
    textPrimary: currentTheme.textPrimary,
    textSecondary: currentTheme.textSecondary,
    borderRadius: currentTheme.borderRadius,
  };
}

// Static export for components that can't use hooks
export const getThemeColors = (theme = 'dark') => {
  const currentTheme = theme === 'light' ? lightTheme : darkTheme;
  return {
    primary: currentTheme.primaryColor,
    background: currentTheme.backgroundColor,
    card: currentTheme.cardColor,
    textPrimary: currentTheme.textPrimary,
    textSecondary: currentTheme.textSecondary,
    borderRadius: currentTheme.borderRadius,
  };
};

// Default export for backward compatibility
export const theme = darkTheme;
export const colors = {
  primary: darkTheme.primaryColor,
  background: darkTheme.backgroundColor,
  card: darkTheme.cardColor,
  textPrimary: darkTheme.textPrimary,
  textSecondary: darkTheme.textSecondary,
};
export const borderRadius = darkTheme.borderRadius;
