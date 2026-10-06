import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppSettings } from '@/types';

const STORAGE_KEY = '@sai_kitchen_settings';

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'EUR',
  defaultTiffinPrice: 20,
  defaultDeliveryCharge: 2,
  companyName: "Sai's Kitchen",
  companyPhone: '+358442355458',
  companyAddress: 'Instagram: Jai.sainath11 | Website: saiskitchen.me',
};

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }, [settings]);

  const resetSettings = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      setSettings(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw error;
    }
  }, []);

  return useMemo(() => ({
    settings,
    isLoading,
    updateSettings,
    resetSettings,
  }), [settings, isLoading, updateSettings, resetSettings]);
});
