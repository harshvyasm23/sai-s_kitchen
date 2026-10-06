import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Calendar, Package, UtensilsCrossed, Edit2, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCustomers } from '@/contexts/CustomerContext';
import { useTiffins } from '@/contexts/TiffinContext';
import { useCatering } from '@/contexts/CateringContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '@/utils/formatters';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const { customers } = useCustomers();
  const { tiffins, calculateTiffinTotal, updateTiffin, deleteTiffin } = useTiffins();
  const { orders, calculateOrderTotal, deleteOrder } = useCatering();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingTiffinId, setEditingTiffinId] = useState<string | null>(null);

  const [editNoonQty, setEditNoonQty] = useState<string>('');
  const [editEveningQty, setEditEveningQty] = useState<string>('');
  const [editDeliveryCharge, setEditDeliveryCharge] = useState<string>('');

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.phone.includes(query)
    );
  }, [customers, searchQuery]);

  const filteredTiffins = useMemo(() => {
    if (!selectedCustomerId) return [];
    let filtered = tiffins.filter(t => t.customerId === selectedCustomerId);
    
    if (startDate && endDate) {
      filtered = filtered.filter(t => t.date >= startDate && t.date <= endDate);
    }
    
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }, [tiffins, selectedCustomerId, startDate, endDate]);

  const filteredOrders = useMemo(() => {
    if (!selectedCustomerId) return [];
    let filtered = orders.filter(o => o.customerId === selectedCustomerId);
    
    if (startDate && endDate) {
      filtered = filtered.filter(o => o.date >= startDate && o.date <= endDate);
    }
    
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }, [orders, selectedCustomerId, startDate, endDate]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const totalTiffinAmount = useMemo(() => {
    return filteredTiffins.reduce((sum, t) => sum + calculateTiffinTotal(t), 0);
  }, [filteredTiffins, calculateTiffinTotal]);

  const totalCateringAmount = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + calculateOrderTotal(o), 0);
  }, [filteredOrders, calculateOrderTotal]);

  const handleEditTiffin = (tiffin: any) => {
    setEditingTiffinId(tiffin.id);
    setEditNoonQty(tiffin.noonQty.toString());
    setEditEveningQty(tiffin.eveningQty.toString());
    setEditDeliveryCharge(tiffin.deliveryCharge.toString());
  };

  const handleSaveTiffin = async (tiffinId: string) => {
    try {
      await updateTiffin(tiffinId, {
        noonQty: parseFloat(editNoonQty) || 0,
        eveningQty: parseFloat(editEveningQty) || 0,
        deliveryCharge: parseFloat(editDeliveryCharge) || 0,
      });
      setEditingTiffinId(null);
      Alert.alert('Success', 'Tiffin entry updated successfully');
    } catch {
      Alert.alert('Error', 'Failed to update tiffin entry');
    }
  };

  const handleDeleteTiffin = (tiffinId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this tiffin entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTiffin(tiffinId);
              Alert.alert('Success', 'Tiffin entry deleted successfully');
            } catch {
              Alert.alert('Error', 'Failed to delete tiffin entry');
            }
          },
        },
      ]
    );
  };

  const handleDeleteOrder = (orderId: string) => {
    Alert.alert(
      'Delete Order',
      'Are you sure you want to delete this catering order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrder(orderId);
              Alert.alert('Success', 'Catering order deleted successfully');
            } catch {
              Alert.alert('Error', 'Failed to delete catering order');
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Customer Reports</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Filter entries by customer and date
          </Text>
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.filterCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Search Customer</Text>
            <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Search size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search by name or phone..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {searchQuery && filteredCustomers.length > 0 && (
              <View style={[styles.customerList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {filteredCustomers.map((customer) => (
                  <TouchableOpacity
                    key={customer.id}
                    style={[
                      styles.customerItem,
                      selectedCustomerId === customer.id && { backgroundColor: colors.primary + '20' }
                    ]}
                    onPress={() => {
                      setSelectedCustomerId(customer.id);
                      setSearchQuery('');
                    }}
                  >
                    <Text style={[styles.customerName, { color: colors.text }]}>{customer.name}</Text>
                    <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>{customer.phone}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedCustomer && (
              <View style={[styles.selectedCustomer, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                <Text style={[styles.selectedCustomerName, { color: colors.primary }]}>
                  Selected: {selectedCustomer.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedCustomerId('')}>
                  <Text style={[styles.clearButton, { color: colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[styles.filterCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Date Range (Optional)</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateInputContainer}>
                <Calendar size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.dateInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={startDate}
                  onChangeText={setStartDate}
                  keyboardType="default"
                />
              </View>
              <Text style={[styles.dateSeparator, { color: colors.textSecondary }]}>to</Text>
              <View style={styles.dateInputContainer}>
                <Calendar size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.dateInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={endDate}
                  onChangeText={setEndDate}
                  keyboardType="default"
                />
              </View>
            </View>
          </View>

          {selectedCustomerId && (
            <>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryItem, { backgroundColor: colors.primary + '20' }]}>
                    <Package size={24} color={colors.primary} />
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Tiffin Total</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {formatCurrency(totalTiffinAmount)}
                    </Text>
                  </View>
                  <View style={[styles.summaryItem, { backgroundColor: colors.secondary + '20' }]}>
                    <UtensilsCrossed size={24} color={colors.secondary} />
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Catering Total</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {formatCurrency(totalCateringAmount)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.grandTotalContainer, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                  <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Grand Total</Text>
                  <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
                    {formatCurrency(totalTiffinAmount + totalCateringAmount)}
                  </Text>
                </View>
              </View>

              {filteredTiffins.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Tiffin Entries ({filteredTiffins.length})
                  </Text>
                  {filteredTiffins.map((tiffin) => (
                    <View key={tiffin.id} style={[styles.entryCard, { backgroundColor: colors.surface }]}>
                      <View style={styles.entryHeader}>
                        <Text style={[styles.entryDate, { color: colors.primary }]}>
                          {formatDate(tiffin.date)}
                        </Text>
                        <View style={styles.entryActions}>
                          {editingTiffinId === tiffin.id ? (
                            <>
                              <TouchableOpacity onPress={() => handleSaveTiffin(tiffin.id)}>
                                <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => setEditingTiffinId(null)}>
                                <Text style={[styles.cancelButton, { color: colors.textSecondary }]}>Cancel</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity onPress={() => handleEditTiffin(tiffin)}>
                                <Edit2 size={18} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteTiffin(tiffin.id)}>
                                <Trash2 size={18} color={colors.error} />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                      {editingTiffinId === tiffin.id ? (
                        <View style={styles.editForm}>
                          <View style={styles.editRow}>
                            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Noon Qty:</Text>
                            <TextInput
                              style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                              value={editNoonQty}
                              onChangeText={setEditNoonQty}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.editRow}>
                            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Evening Qty:</Text>
                            <TextInput
                              style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                              value={editEveningQty}
                              onChangeText={setEditEveningQty}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.editRow}>
                            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Delivery:</Text>
                            <TextInput
                              style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                              value={editDeliveryCharge}
                              onChangeText={setEditDeliveryCharge}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      ) : (
                        <>
                          <View style={styles.entryDetails}>
                            <Text style={[styles.entryLabel, { color: colors.textSecondary }]}>Noon Qty:</Text>
                            <Text style={[styles.entryValue, { color: colors.text }]}>{tiffin.noonQty}</Text>
                          </View>
                          <View style={styles.entryDetails}>
                            <Text style={[styles.entryLabel, { color: colors.textSecondary }]}>Evening Qty:</Text>
                            <Text style={[styles.entryValue, { color: colors.text }]}>{tiffin.eveningQty}</Text>
                          </View>
                          <View style={styles.entryDetails}>
                            <Text style={[styles.entryLabel, { color: colors.textSecondary }]}>Unit Price:</Text>
                            <Text style={[styles.entryValue, { color: colors.text }]}>
                              {formatCurrency(tiffin.unitPrice)}
                            </Text>
                          </View>
                          <View style={styles.entryDetails}>
                            <Text style={[styles.entryLabel, { color: colors.textSecondary }]}>Delivery:</Text>
                            <Text style={[styles.entryValue, { color: colors.text }]}>
                              {formatCurrency(tiffin.deliveryCharge)}
                            </Text>
                          </View>
                          <View style={[styles.entryTotal, { borderTopColor: colors.border }]}>
                            <Text style={[styles.entryTotalLabel, { color: colors.text }]}>Total:</Text>
                            <Text style={[styles.entryTotalValue, { color: colors.primary }]}>
                              {formatCurrency(calculateTiffinTotal(tiffin))}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {filteredOrders.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Catering Orders ({filteredOrders.length})
                  </Text>
                  {filteredOrders.map((order) => (
                    <View key={order.id} style={[styles.entryCard, { backgroundColor: colors.surface }]}>
                      <View style={styles.entryHeader}>
                        <Text style={[styles.entryDate, { color: colors.secondary }]}>
                          {formatDate(order.date)}
                        </Text>
                        <TouchableOpacity onPress={() => handleDeleteOrder(order.id)}>
                          <Trash2 size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                      {order.items.map((item, index) => (
                        <View key={index} style={styles.orderItem}>
                          <Text style={[styles.itemName, { color: colors.text }]}>{item.itemName}</Text>
                          <Text style={[styles.itemDetails, { color: colors.textSecondary }]}>
                            {item.qty} × {formatCurrency(item.unitPrice)} = {formatCurrency(item.qty * item.unitPrice)}
                          </Text>
                        </View>
                      ))}
                      <View style={styles.entryDetails}>
                        <Text style={[styles.entryLabel, { color: colors.textSecondary }]}>Delivery:</Text>
                        <Text style={[styles.entryValue, { color: colors.text }]}>
                          {formatCurrency(order.deliveryCharge)}
                        </Text>
                      </View>
                      <View style={[styles.entryTotal, { borderTopColor: colors.border }]}>
                        <Text style={[styles.entryTotalLabel, { color: colors.text }]}>Total:</Text>
                        <Text style={[styles.entryTotalValue, { color: colors.secondary }]}>
                          {formatCurrency(calculateOrderTotal(order))}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {filteredTiffins.length === 0 && filteredOrders.length === 0 && (
                <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No entries found for the selected filters
                  </Text>
                </View>
              )}
            </>
          )}

          {!selectedCustomerId && (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Select a customer to view their entries
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: fontSize.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  filterCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  filterTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
  },
  customerList: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    maxHeight: 200,
  },
  customerItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  customerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  customerPhone: {
    fontSize: fontSize.sm,
  },
  selectedCustomer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  selectedCustomerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  clearButton: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
  },
  dateSeparator: {
    fontSize: fontSize.sm,
  },
  summaryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryItem: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
  },
  summaryValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  grandTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  grandTotalLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  grandTotalValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  entryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  entryDate: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  entryActions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  saveButton: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing.sm,
  },
  cancelButton: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing.sm,
  },
  entryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  entryLabel: {
    fontSize: fontSize.md,
  },
  entryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  entryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
  },
  entryTotalLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  entryTotalValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  orderItem: {
    marginBottom: spacing.sm,
  },
  itemName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  itemDetails: {
    fontSize: fontSize.sm,
  },
  editForm: {
    gap: spacing.md,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  editLabel: {
    fontSize: fontSize.md,
    width: 100,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
  },
  emptyState: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    textAlign: 'center',
  },
});
