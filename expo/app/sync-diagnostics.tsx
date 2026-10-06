import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw, Database, AlertCircle, CheckCircle, Cloud, Smartphone, Trash2 } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useCustomers } from '@/contexts/CustomerContext';
import { useTiffins } from '@/contexts/TiffinContext';
import { useCatering } from '@/contexts/CateringContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { trpc } from '@/lib/trpc';

export default function SyncDiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  
  const { customers, isSyncing: customersSyncing, lastSyncTime: customersLastSync, syncToCloud: syncCustomers } = useCustomers();
  const { tiffins, isSyncing: tiffinsSyncing, lastSyncTime: tiffinsLastSync, syncToCloud: syncTiffins } = useTiffins();
  const { orders, isSyncing: cateringSyncing, lastSyncTime: cateringLastSync, syncToCloud: syncCatering } = useCatering();
  
  const [backendData, setBackendData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const diagnosticsQuery = trpc.sync.diagnostics.get.useQuery(undefined, { enabled: false });
  const clearBackendMutation = trpc.sync.diagnostics.clear.useMutation();

  const loadDiagnostics = async () => {
    try {
      setIsLoading(true);
      const result = await diagnosticsQuery.refetch();
      if (result.data) {
        setBackendData(result.data);
        console.log('Backend diagnostics:', result.data);
      }
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
      Alert.alert('Error', 'Failed to load backend diagnostics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDiagnostics();
    setRefreshing(false);
  };

  const handleSyncAll = async () => {
    try {
      setIsLoading(true);
      console.log('Starting full sync...');
      
      const errors: string[] = [];
      
      try {
        console.log('Syncing customers...');
        await syncCustomers();
        console.log('Customers synced');
      } catch (error: any) {
        console.error('Customer sync error:', error);
        errors.push(`Customers: ${error.message || 'Unknown error'}`);
      }
      
      try {
        console.log('Syncing tiffins...');
        await syncTiffins();
        console.log('Tiffins synced');
      } catch (error: any) {
        console.error('Tiffin sync error:', error);
        errors.push(`Tiffins: ${error.message || 'Unknown error'}`);
      }
      
      try {
        console.log('Syncing catering...');
        await syncCatering();
        console.log('Catering synced');
      } catch (error: any) {
        console.error('Catering sync error:', error);
        errors.push(`Catering: ${error.message || 'Unknown error'}`);
      }
      
      await loadDiagnostics();
      
      if (errors.length > 0) {
        Alert.alert(
          'Sync Completed with Errors',
          `Some data failed to sync:\n\n${errors.join('\n')}\n\nPlease check your internet connection and try again.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Success', 'All data synced successfully!');
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearBackend = () => {
    Alert.alert(
      'Clear Backend Data',
      'This will remove all data from the cloud. Your local data will remain safe. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await clearBackendMutation.mutateAsync();
              await loadDiagnostics();
              Alert.alert('Success', 'Backend data cleared. You can now sync fresh data from this device.');
            } catch (error) {
              console.error('Clear error:', error);
              Alert.alert('Error', 'Failed to clear backend data');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const localCustomersCount = customers.length;
  const localTiffinsCount = tiffins.length;
  const localCateringCount = orders.length;

  const backendCustomersCount = backendData?.backend?.customers || 0;
  const backendTiffinsCount = backendData?.backend?.tiffins || 0;
  const backendCateringCount = backendData?.backend?.catering || 0;

  const customersMatch = localCustomersCount === backendCustomersCount;
  const tiffinsMatch = localTiffinsCount === backendTiffinsCount;
  const cateringMatch = localCateringCount === backendCateringCount;

  const allInSync = customersMatch && tiffinsMatch && cateringMatch;

  const DataRow = ({ label, localCount, backendCount, match }: { label: string; localCount: number; backendCount: number; match: boolean }) => (
    <View style={[styles.dataRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.dataLabel}>
        <Text style={[styles.dataLabelText, { color: colors.text }]}>{label}</Text>
        {match ? (
          <CheckCircle size={20} color={colors.success} />
        ) : (
          <AlertCircle size={20} color={colors.warning} />
        )}
      </View>
      <View style={styles.dataValues}>
        <View style={styles.dataValue}>
          <Smartphone size={16} color={colors.textSecondary} />
          <Text style={[styles.dataValueText, { color: colors.text }]}>{localCount}</Text>
        </View>
        <View style={styles.dataValue}>
          <Cloud size={16} color={colors.textSecondary} />
          <Text style={[styles.dataValueText, { color: colors.text }]}>{backendCount}</Text>
        </View>
      </View>
    </View>
  );

  const SyncStatus = ({ label, lastSync, isSyncing }: { label: string; lastSync: string | null; isSyncing: boolean }) => {
    const getTimeAgo = (timestamp: string | null) => {
      if (!timestamp) return 'Never';
      const diff = Date.now() - new Date(timestamp).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    };

    return (
      <View style={[styles.syncStatusRow, { backgroundColor: colors.surface }]}>
        <Text style={[styles.syncStatusLabel, { color: colors.text }]}>{label}</Text>
        {isSyncing ? (
          <View style={styles.syncStatusValue}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.syncStatusText, { color: colors.primary }]}>Syncing...</Text>
          </View>
        ) : (
          <Text style={[styles.syncStatusText, { color: colors.textSecondary }]}>{getTimeAgo(lastSync)}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sync Diagnostics</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={isLoading}>
          <RefreshCw size={24} color={isLoading ? colors.textSecondary : colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.statusCard, { 
          backgroundColor: allInSync ? colors.success + '20' : colors.warning + '20',
          borderColor: allInSync ? colors.success : colors.warning,
        }]}>
          {allInSync ? (
            <CheckCircle size={32} color={colors.success} />
          ) : (
            <AlertCircle size={32} color={colors.warning} />
          )}
          <View style={styles.statusContent}>
            <Text style={[styles.statusTitle, { color: allInSync ? colors.success : colors.warning }]}>
              {allInSync ? 'All Data In Sync' : 'Data Mismatch Detected'}
            </Text>
            <Text style={[styles.statusSubtitle, { color: colors.text }]}>
              {allInSync 
                ? 'Your local and cloud data are synchronized' 
                : 'Local and cloud data counts differ. Sync to resolve.'}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Database size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Comparison</Text>
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <Smartphone size={16} color={colors.textSecondary} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>This Device</Text>
            </View>
            <View style={styles.legendItem}>
              <Cloud size={16} color={colors.textSecondary} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Cloud</Text>
            </View>
          </View>
          <DataRow label="Customers" localCount={localCustomersCount} backendCount={backendCustomersCount} match={customersMatch} />
          <DataRow label="Tiffin Entries" localCount={localTiffinsCount} backendCount={backendTiffinsCount} match={tiffinsMatch} />
          <DataRow label="Catering Orders" localCount={localCateringCount} backendCount={backendCateringCount} match={cateringMatch} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <RefreshCw size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Last Sync Times</Text>
          </View>
          <SyncStatus label="Customers" lastSync={customersLastSync} isSyncing={customersSyncing} />
          <SyncStatus label="Tiffin Entries" lastSync={tiffinsLastSync} isSyncing={tiffinsSyncing} />
          <SyncStatus label="Catering Orders" lastSync={cateringLastSync} isSyncing={cateringSyncing} />
        </View>

        {backendData?.backend?.customersList && backendData.backend.customersList.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Database size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Cloud Customers</Text>
            </View>
            {backendData.backend.customersList.map((customer: any, index: number) => (
              <View key={index} style={[styles.customerRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.customerName, { color: colors.text }]}>{customer.name}</Text>
                <View style={styles.customerCounts}>
                  <Text style={[styles.customerCount, { color: colors.textSecondary }]}>
                    T: {backendData.backend.tiffinsByCustomer?.[customer.id] || 0}
                  </Text>
                  <Text style={[styles.customerCount, { color: colors.textSecondary }]}>
                    C: {backendData.backend.cateringByCustomer?.[customer.id] || 0}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <AlertCircle size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleSyncAll}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <RefreshCw size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Force Sync All Data</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error }]}
            onPress={handleClearBackend}
            disabled={isLoading}
          >
            <Trash2 size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Clear Cloud Data</Text>
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <AlertCircle size={16} color={colors.warning} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Note: The backend uses in-memory storage. Data resets when the server restarts. 
              Use &quot;Force Sync&quot; after server restart to upload your local data.
              {backendData === null && '\n\nBackend connection failed. Please check if the server is running.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    flex: 1,
    marginLeft: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    gap: spacing.md,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statusSubtitle: {
    fontSize: fontSize.sm,
  },
  section: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendText: {
    fontSize: fontSize.xs,
  },
  dataRow: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  dataLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dataLabelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  dataValues: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dataValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dataValueText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  syncStatusLabel: {
    fontSize: fontSize.md,
  },
  syncStatusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  syncStatusText: {
    fontSize: fontSize.sm,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  customerName: {
    fontSize: fontSize.md,
    flex: 1,
  },
  customerCounts: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  customerCount: {
    fontSize: fontSize.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  infoBox: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
