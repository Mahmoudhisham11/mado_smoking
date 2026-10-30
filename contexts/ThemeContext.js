'use client';

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'theme-mode';
const listeners = new Set();

const readTheme = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

const subscribe = (listener) => {
  listeners.add(listener);
  // التغيير من تاب تاني
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

// سكريبت صغير في <head> بيطبق الوضع الفاتح قبل أول رسم للصفحة (من غير وميض)
export const themeInitScript = `try{if(localStorage.getItem('${STORAGE_KEY}')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}`;

export function ThemeProvider({ children }) {
  // الوضع الداكن هو الافتراضي (وعلى السيرفر)
  const resolvedTheme = useSyncExternalStore(subscribe, readTheme, () => 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (mode) => {
    const nextTheme = mode === 'light' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // localStorage ممكن يكون مقفول (private mode)
    }
    document.documentElement.setAttribute('data-theme', nextTheme);
    listeners.forEach((listener) => listener());
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ themeMode: resolvedTheme, resolvedTheme, setTheme, toggleTheme }}>
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
