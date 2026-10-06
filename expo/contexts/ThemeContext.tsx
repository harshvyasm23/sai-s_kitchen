import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';

const STORAGE_KEY = '@sai_kitchen_theme';

export type ThemeMode = 'light' | 'dark' | 'auto';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [isLoading, setIsLoading] = useState(true);

  const loadTheme = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setThemeMode(stored as ThemeMode);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  const updateThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      setThemeMode(mode);
    } catch (error) {
      console.error('Failed to save theme:', error);
      throw error;
    }
  }, []);

  const activeTheme = useMemo(() => {
    if (themeMode === 'auto') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  const isDark = activeTheme === 'dark';

  return useMemo(() => ({
    themeMode,
    activeTheme,
    isDark,
    isLoading,
    updateThemeMode,
  }), [themeMode, activeTheme, isDark, isLoading, updateThemeMode]);
});
