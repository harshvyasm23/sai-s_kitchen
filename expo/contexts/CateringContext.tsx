import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { CateringOrder, CateringItem } from '@/types';
import { trpc } from '@/lib/trpc';

const STORAGE_KEY = '@sai_kitchen_catering';
const LAST_SYNC_KEY = '@sai_kitchen_catering_last_sync';

export const [CateringProvider, useCatering] = createContextHook(() => {
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const syncMutation = trpc.sync.catering.sync.useMutation();
  const getCateringQuery = trpc.sync.catering.get.useQuery(
    { lastSyncTime: lastSyncTime || undefined },
    { enabled: false }
  );

  const loadOrders = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (stored) {
        const parsedOrders = JSON.parse(stored);
        console.log('CateringContext - Loaded orders from storage:', parsedOrders.length);
        console.log('CateringContext - Orders:', parsedOrders);
        setOrders(parsedOrders);
      } else {
        console.log('CateringContext - No orders in storage');
      }
      if (lastSync) {
        setLastSyncTime(lastSync);
      }
    } catch (error) {
      console.error('Failed to load catering orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const saveOrders = useCallback(async (newOrders: CateringOrder[]) => {
    try {
      console.log('CateringContext - Saving orders:', newOrders.length);
      const sortedOrders = [...newOrders].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.createdAt.localeCompare(b.createdAt);
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sortedOrders));
      setOrders(sortedOrders);
      console.log('[CateringContext] Saved and sorted orders:', sortedOrders.length);
    } catch (error) {
      console.error('Failed to save catering orders:', error);
      throw error;
    }
  }, []);

  const syncToCloud = useCallback(async () => {
    if (isSyncing) return { success: false, error: 'Sync already in progress' };
    
    try {
      setIsSyncing(true);
      console.log('[CateringContext] Syncing catering orders to cloud...', orders.length, 'orders');
      
      const syncResult = await syncMutation.mutateAsync({
        orders,
        lastSyncTime: lastSyncTime || undefined,
      });
      
      console.log('[CateringContext] Catering sync result:', syncResult);
      
      const result = await getCateringQuery.refetch();
      
      if (result.data?.orders && result.data.orders.length > 0) {
        const remoteOrders = result.data.orders;
        const mergedOrders = [...orders];
        
        remoteOrders.forEach((remote: CateringOrder) => {
          const existingIndex = mergedOrders.findIndex(o => o.id === remote.id);
          if (existingIndex >= 0) {
            if (new Date(remote.updatedAt) > new Date(mergedOrders[existingIndex].updatedAt)) {
              mergedOrders[existingIndex] = remote;
            }
          } else {
            mergedOrders.push(remote);
          }
        });
        
        await saveOrders(mergedOrders);
      }
      
      const newSyncTime = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNC_KEY, newSyncTime);
      setLastSyncTime(newSyncTime);
      
      console.log('[CateringContext] Catering orders synced successfully');
      return { success: true };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      return { success: false, error: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  }, [orders, lastSyncTime, isSyncing, syncMutation, getCateringQuery, saveOrders]);

  const addOrder = useCallback(async (order: Omit<CateringOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const timestamp = Date.now() + Math.random();
    const newOrder: CateringOrder = {
      ...order,
      id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    console.log('[CateringContext] Adding order:', newOrder.id, 'for customer:', newOrder.customerId, 'date:', newOrder.date);
    const updated = [...orders, newOrder];
    await saveOrders(updated);
    return newOrder;
  }, [orders, saveOrders]);

  const updateOrder = useCallback(async (id: string, updates: Partial<CateringOrder>) => {
    const updated = orders.map((o) =>
      o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
    );
    await saveOrders(updated);
  }, [orders, saveOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    const filtered = orders.filter((o) => o.id !== id);
    await saveOrders(filtered);
  }, [orders, saveOrders]);

  const getOrdersByCustomer = useCallback((customerId: string) => {
    const filtered = orders.filter((o) => o.customerId === customerId);
    console.log(`CateringContext - getOrdersByCustomer(${customerId}):`, filtered.length, 'orders');
    return filtered;
  }, [orders]);

  const getOrdersByDateRange = useCallback((startDate: string, endDate: string) => {
    return orders.filter((o) => o.date >= startDate && o.date <= endDate);
  }, [orders]);

  const calculateItemTotal = useCallback((item: CateringItem) => {
    const qty = Number(item.qty);
    const unitPrice = Number(item.unitPrice);
    const total = qty * unitPrice;
    return Math.round(total * 100) / 100;
  }, []);

  const calculateOrderTotal = useCallback((order: CateringOrder) => {
    const itemsTotal = order.items.reduce((sum, item) => {
      const itemTotal = calculateItemTotal(item);
      return sum + itemTotal;
    }, 0);
    const deliveryCharge = Number(order.deliveryCharge);
    const total = itemsTotal + deliveryCharge;
    return Math.round(total * 100) / 100;
  }, [calculateItemTotal]);

  const importOrders = useCallback(async (importedOrders: CateringOrder[]) => {
    try {
      const validOrders = importedOrders.filter(o => 
        o.id && o.date && o.customerId && typeof o.deliveryCharge === 'number' && 
        Array.isArray(o.items) && o.items.length > 0 && o.createdAt && o.updatedAt
      );
      
      if (validOrders.length === 0) {
        throw new Error('No valid catering orders found in import data');
      }

      const existingIds = new Set(orders.map(o => o.id));
      const newOrders = validOrders.filter(o => !existingIds.has(o.id));
      
      if (newOrders.length === 0) {
        return { imported: 0, skipped: validOrders.length };
      }

      await saveOrders([...orders, ...newOrders]);
      return { imported: newOrders.length, skipped: validOrders.length - newOrders.length };
    } catch (error) {
      console.error('Failed to import catering orders:', error);
      throw error;
    }
  }, [orders, saveOrders]);

  const exportOrders = useCallback(() => {
    return orders;
  }, [orders]);



  return useMemo(() => ({
    orders,
    isLoading,
    isSyncing,
    lastSyncTime,
    addOrder,
    updateOrder,
    deleteOrder,
    getOrdersByCustomer,
    getOrdersByDateRange,
    calculateItemTotal,
    calculateOrderTotal,
    importOrders,
    exportOrders,
    syncToCloud,
  }), [orders, isLoading, isSyncing, lastSyncTime, addOrder, updateOrder, deleteOrder, getOrdersByCustomer, getOrdersByDateRange, calculateItemTotal, calculateOrderTotal, importOrders, exportOrders, syncToCloud]);
});
