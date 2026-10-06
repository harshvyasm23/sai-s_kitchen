import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { TiffinEntry } from '@/types';
import { trpc } from '@/lib/trpc';

const STORAGE_KEY = '@sai_kitchen_tiffins';
const LAST_SYNC_KEY = '@sai_kitchen_tiffins_last_sync';

export const [TiffinProvider, useTiffins] = createContextHook(() => {
  const [tiffins, setTiffins] = useState<TiffinEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const syncMutation = trpc.sync.tiffins.sync.useMutation();
  const getTiffinsQuery = trpc.sync.tiffins.get.useQuery(
    { lastSyncTime: lastSyncTime || undefined },
    { enabled: false }
  );

  const loadTiffins = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (stored) {
        setTiffins(JSON.parse(stored));
      }
      if (lastSync) {
        setLastSyncTime(lastSync);
      }
    } catch (error) {
      console.error('Failed to load tiffins:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTiffins();
  }, [loadTiffins]);

  const saveTiffins = useCallback(async (newTiffins: TiffinEntry[]) => {
    try {
      const sortedTiffins = [...newTiffins].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.createdAt.localeCompare(b.createdAt);
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sortedTiffins));
      setTiffins(sortedTiffins);
      console.log('[TiffinContext] Saved and sorted tiffins:', sortedTiffins.length);
    } catch (error) {
      console.error('Failed to save tiffins:', error);
      throw error;
    }
  }, []);

  const syncToCloud = useCallback(async () => {
    if (isSyncing) return { success: false, error: 'Sync already in progress' };
    
    try {
      setIsSyncing(true);
      console.log('[TiffinContext] Syncing tiffins to cloud...', tiffins.length, 'tiffins');
      
      const syncResult = await syncMutation.mutateAsync({
        tiffins,
        lastSyncTime: lastSyncTime || undefined,
      });
      
      console.log('[TiffinContext] Tiffins sync result:', syncResult);
      
      const result = await getTiffinsQuery.refetch();
      
      if (result.data?.tiffins && result.data.tiffins.length > 0) {
        const remoteTiffins = result.data.tiffins;
        const mergedTiffins = [...tiffins];
        
        remoteTiffins.forEach((remote: TiffinEntry) => {
          const existingIndex = mergedTiffins.findIndex(t => t.id === remote.id);
          if (existingIndex >= 0) {
            if (new Date(remote.updatedAt) > new Date(mergedTiffins[existingIndex].updatedAt)) {
              mergedTiffins[existingIndex] = remote;
            }
          } else {
            mergedTiffins.push(remote);
          }
        });
        
        await saveTiffins(mergedTiffins);
      }
      
      const newSyncTime = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNC_KEY, newSyncTime);
      setLastSyncTime(newSyncTime);
      
      console.log('[TiffinContext] Tiffins synced successfully');
      return { success: true };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      return { success: false, error: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  }, [tiffins, lastSyncTime, isSyncing, syncMutation, getTiffinsQuery, saveTiffins]);

  const addTiffin = useCallback(async (tiffin: Omit<TiffinEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const timestamp = Date.now() + Math.random();
    const newTiffin: TiffinEntry = {
      ...tiffin,
      id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    console.log('[TiffinContext] Adding tiffin:', newTiffin.id, 'for customer:', newTiffin.customerId, 'date:', newTiffin.date);
    const updated = [...tiffins, newTiffin];
    await saveTiffins(updated);
    return newTiffin;
  }, [tiffins, saveTiffins]);

  const addMultipleTiffins = useCallback(async (tiffinsData: Omit<TiffinEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    console.log('[TiffinContext] addMultipleTiffins called with:', tiffinsData.length, 'entries');
    console.log('[TiffinContext] Current tiffins count:', tiffins.length);
    
    const now = new Date().toISOString();
    const baseTimestamp = Date.now();
    const newTiffins: TiffinEntry[] = tiffinsData.map((tiffin, index) => {
      const uniqueId = `tiffin-${baseTimestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`;
      const entry = {
        ...tiffin,
        id: uniqueId,
        createdAt: now,
        updatedAt: now,
      };
      console.log('[TiffinContext] Creating entry:', {
        id: entry.id,
        customerId: entry.customerId,
        date: entry.date,
        noonQty: entry.noonQty,
        eveningQty: entry.eveningQty,
      });
      return entry;
    });
    
    console.log('[TiffinContext] Created', newTiffins.length, 'new tiffin entries');
    const updated = [...tiffins, ...newTiffins];
    console.log('[TiffinContext] Total tiffins after merge:', updated.length);
    
    await saveTiffins(updated);
    console.log('[TiffinContext] Save completed. Verifying...');
    
    const verifyStored = await AsyncStorage.getItem(STORAGE_KEY);
    if (verifyStored) {
      const parsed = JSON.parse(verifyStored);
      console.log('[TiffinContext] Verified stored tiffins count:', parsed.length);
    }
    
    return newTiffins;
  }, [tiffins, saveTiffins]);

  const updateTiffin = useCallback(async (id: string, updates: Partial<TiffinEntry>) => {
    const updated = tiffins.map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    await saveTiffins(updated);
  }, [tiffins, saveTiffins]);

  const deleteTiffin = useCallback(async (id: string) => {
    const filtered = tiffins.filter((t) => t.id !== id);
    await saveTiffins(filtered);
  }, [tiffins, saveTiffins]);

  const getTiffinsByCustomer = useCallback((customerId: string) => {
    return tiffins.filter((t) => t.customerId === customerId);
  }, [tiffins]);

  const getTiffinsByDateRange = useCallback((startDate: string, endDate: string) => {
    return tiffins.filter((t) => t.date >= startDate && t.date <= endDate);
  }, [tiffins]);

  const calculateTiffinTotal = useCallback((tiffin: TiffinEntry) => {
    const qty = Number(tiffin.noonQty) + Number(tiffin.eveningQty);
    const unitPrice = Number(tiffin.unitPrice);
    const deliveryCharge = Number(tiffin.deliveryCharge);
    const total = qty * unitPrice + deliveryCharge;
    return Math.round(total * 100) / 100;
  }, []);

  const importTiffins = useCallback(async (importedTiffins: TiffinEntry[]) => {
    try {
      const validTiffins = importedTiffins.filter(t => 
        t.id && t.date && t.customerId && typeof t.noonQty === 'number' && 
        typeof t.eveningQty === 'number' && typeof t.unitPrice === 'number' && 
        typeof t.deliveryCharge === 'number' && t.createdAt && t.updatedAt
      );
      
      if (validTiffins.length === 0) {
        throw new Error('No valid tiffin entries found in import data');
      }

      const existingIds = new Set(tiffins.map(t => t.id));
      const newTiffins = validTiffins.filter(t => !existingIds.has(t.id));
      
      if (newTiffins.length === 0) {
        throw new Error('All tiffin entries already exist');
      }

      await saveTiffins([...tiffins, ...newTiffins]);
      return { imported: newTiffins.length, skipped: validTiffins.length - newTiffins.length };
    } catch (error) {
      console.error('Failed to import tiffins:', error);
      throw error;
    }
  }, [tiffins, saveTiffins]);

  const exportTiffins = useCallback(() => {
    return tiffins;
  }, [tiffins]);



  return useMemo(() => ({
    tiffins,
    isLoading,
    isSyncing,
    lastSyncTime,
    addTiffin,
    addMultipleTiffins,
    updateTiffin,
    deleteTiffin,
    getTiffinsByCustomer,
    getTiffinsByDateRange,
    calculateTiffinTotal,
    importTiffins,
    exportTiffins,
    syncToCloud,
  }), [tiffins, isLoading, isSyncing, lastSyncTime, addTiffin, addMultipleTiffins, updateTiffin, deleteTiffin, getTiffinsByCustomer, getTiffinsByDateRange, calculateTiffinTotal, importTiffins, exportTiffins, syncToCloud]);
});
