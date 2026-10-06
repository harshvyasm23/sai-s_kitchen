import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings as SettingsIcon, Sun, Moon, Monitor, Palette, Database, Info, Calendar, FileText, DollarSign, Download, Upload, Activity } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useCustomers } from '@/contexts/CustomerContext';
import { useTiffins } from '@/contexts/TiffinContext';
import { useCatering } from '@/contexts/CateringContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themeMode, isDark, updateThemeMode } = useTheme();
  const { settings } = useSettings();
  const { customers, addCustomer, importCustomers, exportCustomers } = useCustomers();
  const { addTiffin, importTiffins, exportTiffins } = useTiffins();
  const { addOrder, importOrders, exportOrders } = useCatering();
  const colors = isDark ? darkColors : lightColors;

  const handleExportData = async (type: 'customers' | 'tiffins' | 'catering' | 'all') => {
    try {
      let data: any = {};
      let filename = '';

      switch (type) {
        case 'customers':
          data = { customers: exportCustomers() };
          filename = `sai-kitchen-customers-${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'tiffins':
          data = { tiffins: exportTiffins() };
          filename = `sai-kitchen-tiffins-${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'catering':
          data = { catering: exportOrders() };
          filename = `sai-kitchen-catering-${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'all':
          data = {
            customers: exportCustomers(),
            tiffins: exportTiffins(),
            catering: exportOrders(),
            exportDate: new Date().toISOString(),
          };
          filename = `sai-kitchen-backup-${new Date().toISOString().split('T')[0]}.json`;
          break;
      }

      const jsonString = JSON.stringify(data, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'Data exported successfully!');
      } else {
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, jsonString);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Success', `Data exported to ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data. Please try again.');
    }
  };

  const handleImportData = async () => {
    try {
      let jsonString = '';

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        const filePromise = new Promise<string>((resolve, reject) => {
          input.onchange = async (e: any) => {
            const file = e.target?.files?.[0];
            if (!file) {
              reject(new Error('No file selected'));
              return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
              resolve(event.target?.result as string);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
          };
          input.oncancel = () => reject(new Error('Cancelled'));
        });

        input.click();
        jsonString = await filePromise;
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });

        if (result.canceled) {
          return;
        }

        jsonString = await FileSystem.readAsStringAsync(result.assets[0].uri);
      }

      const data = JSON.parse(jsonString);
      
      let customersImported = 0;
      let tiffinsImported = 0;
      let cateringImported = 0;
      let errors: string[] = [];

      if (data.customers && Array.isArray(data.customers)) {
        try {
          const result = await importCustomers(data.customers);
          customersImported = result.imported;
        } catch (error: any) {
          errors.push(`Customers: ${error.message}`);
        }
      }

      if (data.tiffins && Array.isArray(data.tiffins)) {
        try {
          const result = await importTiffins(data.tiffins);
          tiffinsImported = result.imported;
        } catch (error: any) {
          errors.push(`Tiffins: ${error.message}`);
        }
      }

      if (data.catering && Array.isArray(data.catering)) {
        try {
          const result = await importOrders(data.catering);
          cateringImported = result.imported;
        } catch (error: any) {
          errors.push(`Catering: ${error.message}`);
        }
      }

      const totalImported = customersImported + tiffinsImported + cateringImported;

      if (totalImported === 0 && errors.length === 0) {
        Alert.alert(
          'Import Complete',
          'All data already exists in the app. No new records were imported.'
        );
      } else if (totalImported === 0 && errors.length > 0) {
        Alert.alert(
          'Import Failed',
          errors.join('\n')
        );
      } else {
        let message = `Successfully imported:\n`;
        if (customersImported > 0) message += `• ${customersImported} customers\n`;
        if (tiffinsImported > 0) message += `• ${tiffinsImported} tiffin entries\n`;
        if (cateringImported > 0) message += `• ${cateringImported} catering orders\n`;
        if (errors.length > 0) {
          message += `\nWarnings:\n${errors.join('\n')}`;
        }
        Alert.alert('Import Successful', message);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      Alert.alert('Error', error.message || 'Failed to import data. Please check the file format.');
    }
  };

  const showExportMenu = () => {
    Alert.alert(
      'Export Data',
      'Choose what to export:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Customers Only', onPress: () => handleExportData('customers') },
        { text: 'Tiffin Entries Only', onPress: () => handleExportData('tiffins') },
        { text: 'Catering Orders Only', onPress: () => handleExportData('catering') },
        { text: 'Everything (Backup)', onPress: () => handleExportData('all') },
      ]
    );
  };

  const generateTestData = () => {
    Alert.alert(
      'Generate Test Data',
      'This will add sample customers, tiffin entries, and catering orders. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            const testCustomers = [
              { name: 'Rajesh Kumar', phone: '+31612345678', address: 'Amsterdam Centrum', type: 'Regular' as const, active: true },
              { name: 'Priya Sharma', phone: '+31687654321', address: 'Rotterdam Zuid', type: 'Regular' as const, active: true },
              { name: 'Amit Patel', phone: '+31698765432', address: 'Utrecht Oost', type: 'Occasional' as const, active: true },
              { name: 'Sneha Reddy', phone: '+31623456789', address: 'Den Haag West', type: 'Regular' as const, active: true },
              { name: 'Vikram Singh', phone: '+31634567890', address: 'Eindhoven Noord', type: 'Occasional' as const, active: true },
            ];

            for (const customer of testCustomers) {
              const newCustomer = await addCustomer(customer);
              const customerId = newCustomer.id;
              
              const today = new Date();
              for (let i = 0; i < 7; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                if (Math.random() > 0.3) {
                  await addTiffin({
                    date: dateStr,
                    customerId,
                    noonQty: Math.floor(Math.random() * 3) + 1,
                    eveningQty: Math.floor(Math.random() * 3) + 1,
                    unitPrice: settings.defaultTiffinPrice,
                    deliveryCharge: settings.defaultDeliveryCharge,
                    notes: i === 0 ? 'Extra spicy' : undefined,
                  });
                }
              }

              if (Math.random() > 0.5) {
                const date = new Date();
                date.setDate(date.getDate() - Math.floor(Math.random() * 5));
                await addOrder({
                  date: date.toISOString().split('T')[0],
                  customerId,
                  deliveryCharge: 5,
                  notes: 'Party order',
                  items: [
                    { id: Date.now().toString() + '-1', cateringOrderId: '', itemName: 'Biryani', qty: 10, unitPrice: 15, note: 'Chicken' },
                    { id: Date.now().toString() + '-2', cateringOrderId: '', itemName: 'Paneer Tikka', qty: 5, unitPrice: 12 },
                    { id: Date.now().toString() + '-3', cateringOrderId: '', itemName: 'Naan', qty: 20, unitPrice: 2 },
                  ],
                });
              }
            }

            Alert.alert('Success', 'Test data generated successfully!');
          },
        },
      ]
    );
  };

  const ThemeOption = ({ mode, icon: Icon, label }: { mode: ThemeMode; icon: typeof Sun; label: string }) => {
    const isActive = themeMode === mode;
    return (
      <TouchableOpacity
        style={[
          styles.themeOption,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isActive && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }
        ]}
        onPress={() => updateThemeMode(mode)}
      >
        <Icon size={24} color={isActive ? colors.primary : colors.textSecondary} />
        <Text style={[styles.themeLabel, { color: isActive ? colors.primary : colors.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const SettingCard = ({ 
    icon: Icon, 
    title, 
    subtitle, 
    onPress 
  }: { 
    icon: typeof SettingsIcon; 
    title: string; 
    subtitle: string; 
    onPress: () => void;
  }) => (
    <TouchableOpacity 
      style={[styles.settingCard, { backgroundColor: colors.surface }]} 
      onPress={onPress}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.primary + '20' }]}>
        <Icon size={24} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Palette size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Theme</Text>
          </View>
          <View style={styles.themeOptions}>
            <ThemeOption mode="light" icon={Sun} label="Light" />
            <ThemeOption mode="dark" icon={Moon} label="Dark" />
            <ThemeOption mode="auto" icon={Monitor} label="Auto" />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <FileText size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          </View>
          <SettingCard
            icon={Calendar}
            title="Monthly Entries"
            subtitle="View and edit entries by month"
            onPress={() => router.push('/monthly-entries')}
          />
          <SettingCard
            icon={FileText}
            title="View All Entries"
            subtitle="Browse entries by date range"
            onPress={() => router.push('/view-entries')}
          />
          <SettingCard
            icon={DollarSign}
            title="Outstanding Report"
            subtitle="Check pending payments"
            onPress={() => router.push('/outstanding-report')}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Database size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>
          </View>
          <SettingCard
            icon={Activity}
            title="Sync Diagnostics"
            subtitle="Check sync status and resolve data conflicts"
            onPress={() => router.push('/sync-diagnostics')}
          />
          <SettingCard
            icon={Upload}
            title="Import Data"
            subtitle="Import customers, tiffins, and catering from file"
            onPress={handleImportData}
          />
          <SettingCard
            icon={Download}
            title="Export Data"
            subtitle="Backup your data to use on another device"
            onPress={showExportMenu}
          />
          <SettingCard
            icon={Database}
            title="Generate Test Data"
            subtitle="Add sample customers and entries for testing"
            onPress={generateTestData}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Info size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>App Info</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Customers</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{customers.length}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Currency</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{settings.currency}</Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
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
  themeOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    gap: spacing.xs,
  },
  themeLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  settingSubtitle: {
    fontSize: fontSize.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSize.md,
  },
  infoValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
});
