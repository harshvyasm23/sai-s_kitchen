import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Alert, FlatList, Modal, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, X, Check } from 'lucide-react-native';
import { useCatering } from '@/contexts/CateringContext';
import { useCustomers } from '@/contexts/CustomerContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { getTodayDate } from '@/utils/dateHelpers';


export default function AddCateringScreen() {
  const insets = useSafeAreaInsets();
  const { addOrder } = useCatering();
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [date, setDate] = useState(getTodayDate());
  const [deliveryCharge, setDeliveryCharge] = useState(settings.defaultDeliveryCharge.toString());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ itemName: string; qty: string; unitPrice: string }[]>([
    { itemName: '', qty: '0', unitPrice: '0' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery) return customers;
    const query = customerSearchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.phone.includes(query)
    );
  }, [customers, customerSearchQuery]);

  const selectedCustomers = useMemo(() => 
    customers.filter(c => selectedCustomerIds.includes(c.id)),
    [customers, selectedCustomerIds]
  );

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const isCustomerSelected = (customerId: string) => selectedCustomerIds.includes(customerId);

  const addItem = () => {
    setItems([...items, { itemName: '', qty: '0', unitPrice: '0' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const parseDecimal = (value: string): number => {
    const normalized = value.replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const updateItem = (index: number, field: 'itemName' | 'qty' | 'unitPrice', value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSubmit = async () => {
    if (selectedCustomerIds.length === 0) {
      Alert.alert('Error', 'Please select at least one customer');
      return;
    }

    const validItems = items.filter((item) => item.itemName.trim() && parseDecimal(item.qty) > 0);
    if (validItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderData = {
        date,
        deliveryCharge: parseDecimal(deliveryCharge),
        notes: notes.trim() || undefined,
      };

      const newOrders = selectedCustomerIds.map((customerId) => {
        const orderId = `${Date.now()}-${customerId}-${Math.random().toString(36).substr(2, 9)}`;
        const itemsWithIds = validItems.map((item, index) => ({
          itemName: item.itemName,
          qty: parseDecimal(item.qty),
          unitPrice: parseDecimal(item.unitPrice),
          id: `${orderId}-${index}`,
          cateringOrderId: orderId,
        }));

        return {
          ...orderData,
          customerId,
          items: itemsWithIds,
        };
      });

      for (const order of newOrders) {
        await addOrder(order);
      }

      Alert.alert('Success', `Catering orders added for ${selectedCustomerIds.length} customer(s)`);
      router.back();
    } catch (error) {
      console.error('Failed to add catering order:', error);
      Alert.alert('Error', 'Failed to add catering orders. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const itemsTotal = items.reduce((sum, item) => sum + (parseDecimal(item.qty) * parseDecimal(item.unitPrice)), 0);
  const deliveryChargeNum = parseDecimal(deliveryCharge);
  const totalPricePerCustomer = itemsTotal + deliveryChargeNum;
  const totalPriceAll = totalPricePerCustomer * selectedCustomerIds.length;

  return (
    <KeyboardAvoidingView 
      style={[styles.wrapper, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: 'Add Catering Order',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Customers * ({selectedCustomerIds.length} selected)</Text>
          <TouchableOpacity
            style={[styles.customerSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowCustomerSearch(true)}
          >
            <Text style={[styles.customerSelectorText, { color: selectedCustomers.length > 0 ? colors.text : colors.textSecondary }]}>
              {selectedCustomers.length > 0 
                ? selectedCustomers.length === 1 
                  ? selectedCustomers[0].name 
                  : `${selectedCustomers.length} customers selected`
                : 'Select customers...'}
            </Text>
            <Search size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          {selectedCustomers.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedCustomersScroll}>
              <View style={styles.selectedCustomersContainer}>
                {selectedCustomers.map((customer) => (
                  <View key={customer.id} style={[styles.selectedCustomerChip, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.selectedCustomerChipText, { color: colors.primary }]}>{customer.name}</Text>
                    <TouchableOpacity onPress={() => toggleCustomerSelection(customer.id)}>
                      <X size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        <Modal
          visible={showCustomerSearch}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCustomerSearch(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Customers</Text>
                <TouchableOpacity onPress={() => setShowCustomerSearch(false)}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
                <Search size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search by name or phone..."
                  value={customerSearchQuery}
                  onChangeText={setCustomerSearchQuery}
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                />
              </View>

              <FlatList
                data={filteredCustomers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const selected = isCustomerSelected(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.customerItem, { backgroundColor: selected ? colors.primary + '15' : colors.surface, borderColor: selected ? colors.primary : 'transparent', borderWidth: 1 }]}
                      onPress={() => toggleCustomerSelection(item.id)}
                    >
                      <View style={styles.customerItemContent}>
                        <Text style={[styles.customerItemName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.customerItemPhone, { color: colors.textSecondary }]}>{item.phone}</Text>
                      </View>
                      {selected && (
                        <View style={[styles.checkIcon, { backgroundColor: colors.primary }]}>
                          <Check size={16} color={colors.surface} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.customerList}
              />

              <View style={[styles.modalFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <Text style={[styles.selectedCountText, { color: colors.text }]}>{selectedCustomerIds.length} customer(s) selected</Text>
                <TouchableOpacity 
                  style={[styles.doneButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowCustomerSearch(false);
                    setCustomerSearchQuery('');
                  }}
                >
                  <Text style={[styles.doneButtonText, { color: colors.surface }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Date *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.itemsSection}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Items</Text>
            <TouchableOpacity style={[styles.addItemButton, { backgroundColor: colors.secondary }]} onPress={addItem}>
              <Plus size={20} color={colors.surface} />
              <Text style={[styles.addItemButtonText, { color: colors.surface }]}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, index) => (
            <View key={index} style={[styles.itemCard, { backgroundColor: colors.surface }]}>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemNumber, { color: colors.text }]}>Item {index + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(index)}>
                    <Trash2 size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={item.itemName}
                onChangeText={(value) => updateItem(index, 'itemName', value)}
                placeholder="Item name"
                placeholderTextColor={colors.textSecondary}
              />

              <View style={styles.row}>
                <View style={[styles.field, styles.halfField]}>
                  <Text style={[styles.label, { color: colors.text }]}>Quantity</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={item.qty}
                    onChangeText={(value) => updateItem(index, 'qty', value)}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.field, styles.halfField]}>
                  <Text style={[styles.label, { color: colors.text }]}>Unit Price (€)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={item.unitPrice}
                    onChangeText={(value) => updateItem(index, 'unitPrice', value)}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={[styles.itemTotal, { borderTopColor: colors.border }]}>
                <Text style={[styles.itemTotalLabel, { color: colors.textSecondary }]}>Item Total:</Text>
                <Text style={[styles.itemTotalValue, { color: colors.primary }]}>€{(parseDecimal(item.qty) * parseDecimal(item.unitPrice)).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Delivery Charge (€)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={deliveryCharge}
            onChangeText={setDeliveryCharge}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes (optional)"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={[styles.totalCard, { backgroundColor: colors.primary + '20' }]}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Items Total:</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>€{itemsTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Delivery:</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>€{deliveryChargeNum.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow, { borderTopColor: colors.primary }]}>
            <Text style={[styles.grandTotalLabel, { color: colors.text }]}>{selectedCustomerIds.length > 1 ? 'Per Customer:' : 'Grand Total:'}</Text>
            <Text style={[styles.grandTotalValue, { color: colors.primary }]}>€{totalPricePerCustomer.toFixed(2)}</Text>
          </View>
          {selectedCustomerIds.length > 1 && (
            <View style={[styles.totalRow, styles.allCustomersRow, { borderTopColor: colors.primary }]}>
              <Text style={[styles.allCustomersLabel, { color: colors.text }]}>Total ({selectedCustomerIds.length} customers):</Text>
              <Text style={[styles.allCustomersValue, { color: colors.primary }]}>€{totalPriceAll.toFixed(2)}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={[styles.submitButtonText, { color: colors.surface }]}>
            {isSubmitting ? 'Adding...' : selectedCustomerIds.length > 1 ? `Add Orders (${selectedCustomerIds.length})` : 'Add Catering Order'}
          </Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  field: {
    marginBottom: spacing.lg,
  },
  halfField: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
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
  customerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  customerSelectorText: {
    fontSize: fontSize.md,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: fontSize.md,
  },
  customerList: {
    paddingHorizontal: spacing.lg,
  },
  customerItem: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  customerItemContent: {
    gap: spacing.xs,
    flex: 1,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCustomersScroll: {
    marginTop: spacing.sm,
  },
  selectedCustomersContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectedCustomerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  selectedCustomerChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  selectedCountText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  doneButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  doneButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  customerItemName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  customerItemPhone: {
    fontSize: fontSize.sm,
  },
  itemsSection: {
    marginBottom: spacing.lg,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addItemButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  itemCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  itemNumber: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  itemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  itemTotalLabel: {
    fontSize: fontSize.sm,
  },
  itemTotalValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  totalCard: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  totalLabel: {
    fontSize: fontSize.md,
  },
  totalValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  grandTotalRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
  },
  grandTotalLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  grandTotalValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  allCustomersRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
  },
  allCustomersLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  allCustomersValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  submitButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
