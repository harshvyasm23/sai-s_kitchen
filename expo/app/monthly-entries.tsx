import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useState, useMemo, useRef, useCallback } from 'react';
import { Calendar, Filter, Edit2, Package, UtensilsCrossed, X, ChevronDown, Trash2, Save } from 'lucide-react-native';
import { useTiffins } from '@/contexts/TiffinContext';
import { useCatering } from '@/contexts/CateringContext';
import { useCustomers } from '@/contexts/CustomerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { formatDisplayDate } from '@/utils/dateHelpers';
import { TiffinEntry, CateringOrder } from '@/types';

type EntryType = 'all' | 'tiffin' | 'catering';

export default function MonthlyEntriesScreen() {
  const insets = useSafeAreaInsets();
  const { tiffins, updateTiffin, deleteTiffin, calculateTiffinTotal } = useTiffins();
  const { orders, updateOrder, deleteOrder, calculateOrderTotal } = useCatering();
  const { customers } = useCustomers();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [entryType, setEntryType] = useState<EntryType>('all');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ type: 'tiffin' | 'catering'; data: TiffinEntry | CateringOrder } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const getCustomerName = useCallback((customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  }, [customers]);

  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push(monthStr);
    }
    return options;
  }, []);

  const filteredEntries = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const entries: { type: 'tiffin' | 'catering'; data: TiffinEntry | CateringOrder }[] = [];

    if (entryType === 'all' || entryType === 'tiffin') {
      tiffins
        .filter(t => t.date >= startDate && t.date <= endDate)
        .forEach(t => entries.push({ type: 'tiffin', data: t }));
    }

    if (entryType === 'all' || entryType === 'catering') {
      orders
        .filter(o => o.date >= startDate && o.date <= endDate)
        .forEach(o => entries.push({ type: 'catering', data: o }));
    }

    const sorted = entries.sort((a, b) => {
      const dateCompare = a.data.date.localeCompare(b.data.date);
      if (dateCompare !== 0) return dateCompare;
      
      const customerNameA = getCustomerName(a.data.customerId).toLowerCase();
      const customerNameB = getCustomerName(b.data.customerId).toLowerCase();
      const customerCompare = customerNameA.localeCompare(customerNameB);
      if (customerCompare !== 0) return customerCompare;
      
      return a.data.createdAt.localeCompare(b.data.createdAt);
    });

    console.log('[MonthlyEntries] Filtered and sorted entries:', sorted.length);
    sorted.forEach((entry, idx) => {
      console.log(`  [${idx}] ${entry.data.date} - ${getCustomerName(entry.data.customerId)} - ${entry.type} - createdAt: ${entry.data.createdAt}`);
    });

    return sorted;
  }, [tiffins, orders, selectedMonth, entryType, getCustomerName]);

  const handleEdit = (type: 'tiffin' | 'catering', data: TiffinEntry | CateringOrder) => {
    setEditingEntry({ type, data });
    setShowEditModal(true);
  };

  const handleDelete = (type: 'tiffin' | 'catering', id: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (type === 'tiffin') {
                await deleteTiffin(id);
              } else {
                await deleteOrder(id);
              }
              Alert.alert('Success', 'Entry deleted successfully');
            } catch {
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const getMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const renderEntry = ({ item }: { item: { type: 'tiffin' | 'catering'; data: TiffinEntry | CateringOrder } }) => {
    const { type, data } = item;
    const customerName = getCustomerName(data.customerId);

    if (type === 'tiffin') {
      const tiffin = data as TiffinEntry;
      const total = calculateTiffinTotal(tiffin);

      return (
        <View style={[styles.entryCard, { backgroundColor: colors.surface }]}>
          <View style={styles.entryHeader}>
            <View style={styles.entryHeaderLeft}>
              <View style={[styles.iconBadge, { backgroundColor: colors.primary + '20' }]}>
                <Package size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.entryType, { color: colors.primary }]}>Tiffin</Text>
                <Text style={[styles.entryDate, { color: colors.textSecondary }]}>{formatDisplayDate(tiffin.date)}</Text>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => handleEdit('tiffin', tiffin)} style={styles.actionButton}>
                <Edit2 size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete('tiffin', tiffin.id)} style={styles.actionButton}>
                <Trash2 size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.customerName, { color: colors.text }]}>{customerName}</Text>

          <View style={styles.entryDetails}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Noon Qty:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{tiffin.noonQty}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Evening Qty:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{tiffin.eveningQty}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Unit Price:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>€{tiffin.unitPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Delivery:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>€{tiffin.deliveryCharge.toFixed(2)}</Text>
            </View>
          </View>

          {tiffin.notes && (
            <Text style={[styles.notes, { color: colors.textSecondary }]}>Note: {tiffin.notes}</Text>
          )}

          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total:</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>€{total.toFixed(2)}</Text>
          </View>
        </View>
      );
    } else {
      const catering = data as CateringOrder;
      const total = calculateOrderTotal(catering);

      return (
        <View style={[styles.entryCard, { backgroundColor: colors.surface }]}>
          <View style={styles.entryHeader}>
            <View style={styles.entryHeaderLeft}>
              <View style={[styles.iconBadge, { backgroundColor: colors.secondary + '20' }]}>
                <UtensilsCrossed size={20} color={colors.secondary} />
              </View>
              <View>
                <Text style={[styles.entryType, { color: colors.secondary }]}>Catering</Text>
                <Text style={[styles.entryDate, { color: colors.textSecondary }]}>{formatDisplayDate(catering.date)}</Text>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => handleEdit('catering', catering)} style={styles.actionButton}>
                <Edit2 size={20} color={colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete('catering', catering.id)} style={styles.actionButton}>
                <Trash2 size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.customerName, { color: colors.text }]}>{customerName}</Text>

          <View style={styles.itemsList}>
            {catering.items.map((item, index) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {index + 1}. {item.itemName}
                </Text>
                <Text style={[styles.itemDetails, { color: colors.textSecondary }]}>
                  {item.qty} × €{item.unitPrice.toFixed(2)} = €{(item.qty * item.unitPrice).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.entryDetails}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Delivery:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>€{catering.deliveryCharge.toFixed(2)}</Text>
            </View>
          </View>

          {catering.notes && (
            <Text style={[styles.notes, { color: colors.textSecondary }]}>Note: {catering.notes}</Text>
          )}

          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total:</Text>
            <Text style={[styles.totalValue, { color: colors.secondary }]}>€{total.toFixed(2)}</Text>
          </View>
        </View>
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Monthly Entries',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.surface }]}
          onPress={() => setShowMonthPicker(true)}
        >
          <Calendar size={18} color={colors.primary} />
          <View style={styles.filterButtonText}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Month</Text>
            <Text style={[styles.filterValue, { color: colors.text }]}>{getMonthLabel(selectedMonth)}</Text>
          </View>
          <ChevronDown size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.surface }]}
          onPress={() => {
            const types: EntryType[] = ['all', 'tiffin', 'catering'];
            const currentIndex = types.indexOf(entryType);
            setEntryType(types[(currentIndex + 1) % types.length]);
          }}
        >
          <Filter size={18} color={colors.secondary} />
          <View style={styles.filterButtonText}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Type</Text>
            <Text style={[styles.filterValue, { color: colors.text }]}>
              {entryType === 'all' ? 'All' : entryType === 'tiffin' ? 'Tiffin' : 'Catering'}
            </Text>
          </View>
          <ChevronDown size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsBar}>
        <Text style={[styles.statsText, { color: colors.textSecondary }]}>
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} found
        </Text>
      </View>

      <FlatList
        data={filteredEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.lg }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No entries found for this month</Text>
          </View>
        }
      />

      <Modal
        visible={showMonthPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.monthOptions}>
              {monthOptions.map((month) => (
                <TouchableOpacity
                  key={month}
                  style={[
                    styles.monthOption,
                    { backgroundColor: colors.surface },
                    selectedMonth === month && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setSelectedMonth(month);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={[
                    styles.monthOptionText,
                    { color: colors.text },
                    selectedMonth === month && { color: colors.primary, fontWeight: fontWeight.semibold }
                  ]}>
                    {getMonthLabel(month)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {editingEntry && (
        <EditEntryModal
          visible={showEditModal}
          entry={editingEntry}
          onClose={() => {
            setShowEditModal(false);
            setEditingEntry(null);
          }}
          onSave={async (updates) => {
            try {
              if (editingEntry.type === 'tiffin') {
                await updateTiffin(editingEntry.data.id, updates);
              } else {
                await updateOrder(editingEntry.data.id, updates);
              }
              Alert.alert('Success', 'Entry updated successfully');
              setShowEditModal(false);
              setEditingEntry(null);
            } catch {
              Alert.alert('Error', 'Failed to update entry');
            }
          }}
          colors={colors}
        />
      )}
    </View>
  );
}

function EditEntryModal({
  visible,
  entry,
  onClose,
  onSave,
  colors,
}: {
  visible: boolean;
  entry: { type: 'tiffin' | 'catering'; data: TiffinEntry | CateringOrder };
  onClose: () => void;
  onSave: (updates: Partial<TiffinEntry | CateringOrder>) => void;
  colors: any;
}) {
  const [formData, setFormData] = useState<any>(entry.data);
  const scrollViewRef = useRef<ScrollView>(null);

  const parseDecimal = (value: string): number => {
    const normalized = value.replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const handleSave = () => {
    if (entry.type === 'tiffin') {
      const tiffin = formData as TiffinEntry;
      if (tiffin.noonQty === 0 && tiffin.eveningQty === 0) {
        Alert.alert('Error', 'Please enter at least one quantity');
        return;
      }
    } else {
      const catering = formData as CateringOrder;
      if (catering.items.length === 0) {
        Alert.alert('Error', 'Please add at least one item');
        return;
      }
    }
    onSave(formData);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.editModalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Edit {entry.type === 'tiffin' ? 'Tiffin' : 'Catering'} Entry
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.editForm}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Date</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.date}
                onChangeText={(value) => setFormData({ ...formData, date: value })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                onFocus={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
              />
            </View>

            {entry.type === 'tiffin' ? (
              <>
                <View style={styles.row}>
                  <View style={[styles.field, styles.halfField]}>
                    <Text style={[styles.label, { color: colors.text }]}>Noon Qty</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      value={formData.noonQty.toString()}
                      onChangeText={(value) => setFormData({ ...formData, noonQty: parseDecimal(value) })}
                      keyboardType="numeric"
                      onFocus={() => scrollViewRef.current?.scrollTo({ y: 50, animated: true })}
                    />
                  </View>
                  <View style={[styles.field, styles.halfField]}>
                    <Text style={[styles.label, { color: colors.text }]}>Evening Qty</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      value={formData.eveningQty.toString()}
                      onChangeText={(value) => setFormData({ ...formData, eveningQty: parseDecimal(value) })}
                      keyboardType="numeric"
                      onFocus={() => scrollViewRef.current?.scrollTo({ y: 50, animated: true })}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.field, styles.halfField]}>
                    <Text style={[styles.label, { color: colors.text }]}>Unit Price (€)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      value={formData.unitPrice.toString()}
                      onChangeText={(value) => setFormData({ ...formData, unitPrice: parseDecimal(value) })}
                      keyboardType="numeric"
                      onFocus={() => scrollViewRef.current?.scrollTo({ y: 150, animated: true })}
                    />
                  </View>
                  <View style={[styles.field, styles.halfField]}>
                    <Text style={[styles.label, { color: colors.text }]}>Delivery (€)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      value={formData.deliveryCharge.toString()}
                      onChangeText={(value) => setFormData({ ...formData, deliveryCharge: parseDecimal(value) })}
                      keyboardType="numeric"
                      onFocus={() => scrollViewRef.current?.scrollTo({ y: 150, animated: true })}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Delivery Charge (€)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={formData.deliveryCharge.toString()}
                  onChangeText={(value) => setFormData({ ...formData, deliveryCharge: parseDecimal(value) })}
                  keyboardType="numeric"
                  onFocus={() => scrollViewRef.current?.scrollTo({ y: 100, animated: true })}
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.notes || ''}
                onChangeText={(value) => setFormData({ ...formData, notes: value })}
                placeholder="Add notes (optional)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                onFocus={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Save size={20} color={colors.surface} />
              <Text style={[styles.saveButtonText, { color: colors.surface }]}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    ...shadows.sm,
  },
  filterButtonText: {
    flex: 1,
  },
  filterLabel: {
    fontSize: fontSize.xs,
  },
  filterValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  statsBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  statsText: {
    fontSize: fontSize.sm,
  },
  listContent: {
    padding: spacing.md,
  },
  entryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  entryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryType: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  entryDate: {
    fontSize: fontSize.xs,
  },
  customerName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  entryDetails: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: fontSize.sm,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  itemsList: {
    marginBottom: spacing.sm,
  },
  itemRow: {
    marginBottom: spacing.xs,
  },
  itemName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  itemDetails: {
    fontSize: fontSize.xs,
    marginLeft: spacing.md,
  },
  notes: {
    fontSize: fontSize.sm,
    fontStyle: 'italic' as const,
    marginBottom: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  totalValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  editModalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  monthOptions: {
    padding: spacing.lg,
  },
  monthOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  monthOptionText: {
    fontSize: fontSize.md,
  },
  editForm: {
    padding: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  saveButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
