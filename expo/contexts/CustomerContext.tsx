import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer } from '@/types';
import { trpc } from '@/lib/trpc';

const STORAGE_KEY = '@sai_kitchen_customers';
const LAST_SYNC_KEY = '@sai_kitchen_customers_last_sync';

export const [CustomerProvider, useCustomers] = createContextHook(() => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const syncMutation = trpc.sync.customers.sync.useMutation();
  const getCustomersQuery = trpc.sync.customers.get.useQuery(
    { lastSyncTime: lastSyncTime || undefined },
    { enabled: false }
  );

  const loadCustomers = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (stored) {
        setCustomers(JSON.parse(stored));
      }
      if (lastSync) {
        setLastSyncTime(lastSync);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const saveCustomers = useCallback(async (newCustomers: Customer[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newCustomers));
      setCustomers(newCustomers);
    } catch (error) {
      console.error('Failed to save customers:', error);
      throw error;
    }
  }, []);

  const syncToCloud = useCallback(async () => {
    if (isSyncing) return { success: false, error: 'Sync already in progress' };
    
    try {
      setIsSyncing(true);
      console.log('[CustomerContext] Syncing customers to cloud...', customers.length, 'customers');
      
      const syncResult = await syncMutation.mutateAsync({
        customers,
        lastSyncTime: lastSyncTime || undefined,
      });
      
      console.log('[CustomerContext] Customers sync result:', syncResult);
      
      const result = await getCustomersQuery.refetch();
      
      if (result.data?.customers && result.data.customers.length > 0) {
        const remoteCustomers = result.data.customers;
        const mergedCustomers = [...customers];
        
        remoteCustomers.forEach((remote: Customer) => {
          const existingIndex = mergedCustomers.findIndex(c => c.id === remote.id);
          if (existingIndex >= 0) {
            if (new Date(remote.updatedAt) > new Date(mergedCustomers[existingIndex].updatedAt)) {
              mergedCustomers[existingIndex] = remote;
            }
          } else {
            mergedCustomers.push(remote);
          }
        });
        
        await saveCustomers(mergedCustomers);
      }
      
      const newSyncTime = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNC_KEY, newSyncTime);
      setLastSyncTime(newSyncTime);
      
      console.log('[CustomerContext] Customers synced successfully');
      return { success: true };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      return { success: false, error: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  }, [customers, lastSyncTime, isSyncing, syncMutation, getCustomersQuery, saveCustomers]);

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCustomer: Customer = {
      ...customer,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveCustomers([...customers, newCustomer]);
    return newCustomer;
  }, [customers, saveCustomers]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    const updated = customers.map((c) =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    );
    await saveCustomers(updated);
  }, [customers, saveCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    const filtered = customers.filter((c) => c.id !== id);
    await saveCustomers(filtered);
  }, [customers, saveCustomers]);

  const getCustomerById = useCallback((id: string) => {
    return customers.find((c) => c.id === id);
  }, [customers]);

  const searchCustomers = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.phone.includes(query)
    );
  }, [customers]);

  const importCustomers = useCallback(async (importedCustomers: Customer[]) => {
    try {
      const validCustomers = importedCustomers.filter(c => 
        c.id && c.name && c.phone && c.type && c.createdAt && c.updatedAt && typeof c.active === 'boolean'
      );
      
      if (validCustomers.length === 0) {
        throw new Error('No valid customers found in import data');
      }

      const existingIds = new Set(customers.map(c => c.id));
      const newCustomers = validCustomers.filter(c => !existingIds.has(c.id));
      
      if (newCustomers.length === 0) {
        throw new Error('All customers already exist');
      }

      await saveCustomers([...customers, ...newCustomers]);
      return { imported: newCustomers.length, skipped: validCustomers.length - newCustomers.length };
    } catch (error) {
      console.error('Failed to import customers:', error);
      throw error;
    }
  }, [customers, saveCustomers]);

  const exportCustomers = useCallback(() => {
    return customers;
  }, [customers]);



  return useMemo(() => ({
    customers,
    isLoading,
    isSyncing,
    lastSyncTime,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerById,
    searchCustomers,
    importCustomers,
    exportCustomers,
    syncToCloud,
  }), [customers, isLoading, isSyncing, lastSyncTime, addCustomer, updateCustomer, deleteCustomer, getCustomerById, searchCustomers, importCustomers, exportCustomers, syncToCloud]);
});

export const useActiveCustomers = () => {
  const { customers } = useCustomers();
  return useMemo(() => customers.filter((c) => c.active), [customers]);
};
