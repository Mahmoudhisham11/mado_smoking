'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState('system'); // 'dark', 'light', or 'system'
  const [resolvedTheme, setResolvedTheme] = useState('dark'); // 'dark' or 'light'

  // Get system preference
  const getSystemTheme = () => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Resolve theme based on mode
  const resolveTheme = (mode) => {
    if (mode === 'system') {
      return getSystemTheme();
    }
    return mode;
  };

  // Initialize theme
  useEffect(() => {
    // Load saved preference from localStorage
    const savedTheme = localStorage.getItem('theme-mode');
    if (savedTheme && ['dark', 'light', 'system'].includes(savedTheme)) {
      setThemeMode(savedTheme);
    }

    // Set initial resolved theme
    const initialResolved = resolveTheme(savedTheme || 'system');
    setResolvedTheme(initialResolved);
    document.documentElement.setAttribute('data-theme', initialResolved);
  }, []);

  // Update resolved theme when themeMode changes
  useEffect(() => {
    const resolved = resolveTheme(themeMode);
    setResolvedTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('theme-mode', themeMode);
  }, [themeMode]);

  // Listen to system theme changes
  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const newTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  const setTheme = (mode) => {
    if (['dark', 'light', 'system'].includes(mode)) {
      setThemeMode(mode);
    }
  };

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}





