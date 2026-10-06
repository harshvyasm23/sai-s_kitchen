import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useState, useMemo } from 'react';
import { Calendar, Package, UtensilsCrossed, User, Search, Filter, X, Edit2, Trash2 } from 'lucide-react-native';
import { useTiffins } from '@/contexts/TiffinContext';
import { useCatering } from '@/contexts/CateringContext';
import { useCustomers } from '@/contexts/CustomerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { TiffinEntry, CateringOrder } from '@/types';

type ViewMode = 'date' | 'customer';
type FilterType = 'all' | 'customer' | 'month' | 'date';

type EntryItem = {
  type: 'tiffin' | 'catering';
  data: TiffinEntry | CateringOrder;
  customerName: string;
  date: string;
  total: number;
};

export default function ViewEntriesScreen() {
  const insets = useSafeAreaInsets();
  const { tiffins, calculateTiffinTotal, updateTiffin, deleteTiffin } = useTiffins();
  const { orders, calculateOrderTotal, updateOrder, deleteOrder } = useCatering();
  const { customers } = useCustomers();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;

  const [viewMode, setViewMode] = useState<ViewMode>('date');
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryItem | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  const months = useMemo(() => {
    const allDates = [...tiffins.map(t => t.date), ...orders.map(o => o.date)];
    const uniqueMonths = new Set<string>();
    allDates.forEach(date => {
      const [year, month] = date.split('-');
      uniqueMonths.add(`${year}-${month}`);
    });
    return Array.from(uniqueMonths).sort().reverse();
  }, [tiffins, orders]);

  const dates = useMemo(() => {
    const allDates = [...tiffins.map(t => t.date), ...orders.map(o => o.date)];
    return Array.from(new Set(allDates)).sort().reverse();
  }, [tiffins, orders]);

  const filteredEntries = useMemo(() => {
    const entries: EntryItem[] = [];

    tiffins.forEach(t => {
      const customer = customers.find(c => c.id === t.customerId);
      const customerName = customer?.name || 'Unknown';
      
      let matches = true;

      if (filterType === 'customer' && selectedCustomerId) {
        matches = t.customerId === selectedCustomerId;
      } else if (filterType === 'month' && selectedMonth) {
        matches = t.date.startsWith(selectedMonth);
      } else if (filterType === 'date' && selectedDate) {
        matches = t.date === selectedDate;
      } else if (searchText) {
        matches = customerName.toLowerCase().includes(searchText.toLowerCase()) ||
                 t.date.includes(searchText);
      }

      if (matches) {
        entries.push({
          type: 'tiffin',
          data: t,
          customerName,
          date: t.date,
          total: calculateTiffinTotal(t)
        });
      }
    });

    orders.forEach(o => {
      const customer = customers.find(c => c.id === o.customerId);
      const customerName = customer?.name || 'Unknown';
      
      let matches = true;

      if (filterType === 'customer' && selectedCustomerId) {
        matches = o.customerId === selectedCustomerId;
      } else if (filterType === 'month' && selectedMonth) {
        matches = o.date.startsWith(selectedMonth);
      } else if (filterType === 'date' && selectedDate) {
        matches = o.date === selectedDate;
      } else if (searchText) {
        matches = customerName.toLowerCase().includes(searchText.toLowerCase()) ||
                 o.date.includes(searchText);
      }

      if (matches) {
        entries.push({
          type: 'catering',
          data: o,
          customerName,
          date: o.date,
          total: calculateOrderTotal(o)
        });
      }
    });

    if (viewMode === 'date') {
      entries.sort((a, b) => b.date.localeCompare(a.date));
    } else {
      entries.sort((a, b) => a.customerName.localeCompare(b.customerName));
    }

    return entries;
  }, [tiffins, orders, customers, searchText, viewMode, calculateTiffinTotal, calculateOrderTotal, filterType, selectedCustomerId, selectedMonth, selectedDate]);

  const getTotalAmount = () => {
    return filteredEntries.reduce((sum, entry) => sum + entry.total, 0);
  };

  const clearFilters = () => {
    setFilterType('all');
    setSelectedCustomerId('');
    setSelectedMonth('');
    setSelectedDate('');
    setSearchText('');
  };

  const getActiveFilterText = () => {
    if (filterType === 'customer' && selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      return customer?.name || 'Unknown Customer';
    }
    if (filterType === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    if (filterType === 'date' && selectedDate) {
      return selectedDate;
    }
    return 'All Entries';
  };

  const handleEdit = (entry: EntryItem) => {
    setEditingEntry(entry);
    if (entry.type === 'tiffin') {
      const tiffin = entry.data as TiffinEntry;
      setEditForm({
        date: tiffin.date,
        noonQty: tiffin.noonQty.toString(),
        eveningQty: tiffin.eveningQty.toString(),
        unitPrice: tiffin.unitPrice.toString(),
        deliveryCharge: tiffin.deliveryCharge.toString(),
        comment: tiffin.comment || '',
      });
    } else {
      const catering = entry.data as CateringOrder;
      setEditForm({
        date: catering.date,
        deliveryCharge: catering.deliveryCharge.toString(),
        comment: catering.comment || '',
        items: catering.items.map(item => ({
          name: item.name || item.itemName,
          qty: item.qty.toString(),
          unitPrice: item.unitPrice.toString(),
        })),
      });
    }
  };

  const handleDelete = (entry: EntryItem) => {
    const entryType = entry.type === 'tiffin' ? 'Tiffin Entry' : 'Catering Order';
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete this ${entryType}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (entry.type === 'tiffin') {
                await deleteTiffin(entry.data.id);
              } else {
                await deleteOrder(entry.data.id);
              }
            } catch {
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !editForm) return;

    try {
      if (editingEntry.type === 'tiffin') {
        await updateTiffin(editingEntry.data.id, {
          date: editForm.date,
          noonQty: parseFloat(editForm.noonQty) || 0,
          eveningQty: parseFloat(editForm.eveningQty) || 0,
          unitPrice: parseFloat(editForm.unitPrice) || 0,
          deliveryCharge: parseFloat(editForm.deliveryCharge) || 0,
          comment: editForm.comment,
        });
      } else {
        await updateOrder(editingEntry.data.id, {
          date: editForm.date,
          deliveryCharge: parseFloat(editForm.deliveryCharge) || 0,
          comment: editForm.comment,
          items: editForm.items.map((item: any) => ({
            id: Date.now().toString() + Math.random(),
            cateringOrderId: editingEntry.data.id,
            itemName: item.name,
            name: item.name,
            qty: parseFloat(item.qty) || 0,
            unitPrice: parseFloat(item.unitPrice) || 0,
          })),
        });
      }
      setEditingEntry(null);
      setEditForm(null);
    } catch {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const updateCateringItem = (index: number, field: string, value: string) => {
    const newItems = [...editForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditForm({ ...editForm, items: newItems });
  };

  const removeCateringItem = (index: number) => {
    const newItems = editForm.items.filter((_: any, i: number) => i !== index);
    setEditForm({ ...editForm, items: newItems });
  };

  const addCateringItem = () => {
    setEditForm({
      ...editForm,
      items: [...editForm.items, { name: '', qty: '0', unitPrice: '0' }],
    });
  };

  const renderEntry = ({ item }: { item: EntryItem }) => {
    const { type, data, customerName, date, total } = item;

    if (type === 'tiffin') {
      const tiffin = data as TiffinEntry;

      return (
        <View style={[styles.entryCard, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBadge, { backgroundColor: colors.primary + '20' }]}>
                <Package size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.customerName, { color: colors.text }]}>{customerName}</Text>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>{date}</Text>
              </View>
            </View>
            <Text style={[styles.totalValue, { color: colors.primary }]}>€{total.toFixed(2)}</Text>
          </View>

          <View style={styles.detailsRow}>
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              Noon: {tiffin.noonQty} | Evening: {tiffin.eveningQty} | @€{tiffin.unitPrice}
            </Text>
          </View>

          {tiffin.comment && (
            <Text style={[styles.commentText, { color: colors.textSecondary }]}>
              {tiffin.comment}
            </Text>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => handleEdit(item)}
            >
              <Edit2 size={16} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#ef444420' }]}
              onPress={() => handleDelete(item)}
            >
              <Trash2 size={16} color="#ef4444" />
              <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } else {
      const catering = data as CateringOrder;

      return (
        <View style={[styles.entryCard, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBadge, { backgroundColor: colors.secondary + '20' }]}>
                <UtensilsCrossed size={18} color={colors.secondary} />
              </View>
              <View>
                <Text style={[styles.customerName, { color: colors.text }]}>{customerName}</Text>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>{date}</Text>
              </View>
            </View>
            <Text style={[styles.totalValue, { color: colors.secondary }]}>€{total.toFixed(2)}</Text>
          </View>

          <View style={styles.detailsRow}>
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {catering.items.length} item{catering.items.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {catering.comment && (
            <Text style={[styles.commentText, { color: colors.textSecondary }]}>
              {catering.comment}
            </Text>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.secondary + '20' }]}
              onPress={() => handleEdit(item)}
            >
              <Edit2 size={16} color={colors.secondary} />
              <Text style={[styles.actionButtonText, { color: colors.secondary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#ef444420' }]}
              onPress={() => handleDelete(item)}
            >
              <Trash2 size={16} color="#ef4444" />
              <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'View Entries',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />

      <View style={[styles.searchSection, { backgroundColor: colors.surface }]}>
        <View style={styles.filterHeader}>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} color="#fff" />
            <Text style={styles.filterButtonText}>Filters</Text>
          </TouchableOpacity>

          {filterType !== 'all' && (
            <View style={[styles.activeFilterBadge, { backgroundColor: colors.background }]}>
              <Text style={[styles.activeFilterText, { color: colors.text }]} numberOfLines={1}>
                {getActiveFilterText()}
              </Text>
              <TouchableOpacity onPress={clearFilters}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {showFilters && (
          <View style={[styles.filtersContainer, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[
                styles.filterOption,
                filterType === 'all' && { backgroundColor: colors.primary + '20' }
              ]}
              onPress={() => {
                clearFilters();
                setShowFilters(false);
              }}
            >
              <Text style={[styles.filterOptionText, { color: colors.text }]}>All Entries</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterOption,
                filterType === 'customer' && { backgroundColor: colors.primary + '20' }
              ]}
              onPress={() => setFilterType('customer')}
            >
              <Text style={[styles.filterOptionText, { color: colors.text }]}>By Customer</Text>
            </TouchableOpacity>

            {filterType === 'customer' && (
              <ScrollView style={styles.optionsList} nestedScrollEnabled>
                {customers.map(customer => (
                  <TouchableOpacity
                    key={customer.id}
                    style={[
                      styles.optionItem,
                      selectedCustomerId === customer.id && { backgroundColor: colors.primary + '10' }
                    ]}
                    onPress={() => {
                      setSelectedCustomerId(customer.id);
                      setShowFilters(false);
                    }}
                  >
                    <Text style={[styles.optionItemText, { color: colors.text }]}>{customer.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.filterOption,
                filterType === 'month' && { backgroundColor: colors.primary + '20' }
              ]}
              onPress={() => setFilterType('month')}
            >
              <Text style={[styles.filterOptionText, { color: colors.text }]}>By Month</Text>
            </TouchableOpacity>

            {filterType === 'month' && (
              <ScrollView style={styles.optionsList} nestedScrollEnabled>
                {months.map(month => {
                  const [year, monthNum] = month.split('-');
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const displayText = `${monthNames[parseInt(monthNum) - 1]} ${year}`;
                  return (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.optionItem,
                        selectedMonth === month && { backgroundColor: colors.primary + '10' }
                      ]}
                      onPress={() => {
                        setSelectedMonth(month);
                        setShowFilters(false);
                      }}
                    >
                      <Text style={[styles.optionItemText, { color: colors.text }]}>{displayText}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.filterOption,
                filterType === 'date' && { backgroundColor: colors.primary + '20' }
              ]}
              onPress={() => setFilterType('date')}
            >
              <Text style={[styles.filterOptionText, { color: colors.text }]}>By Date</Text>
            </TouchableOpacity>

            {filterType === 'date' && (
              <ScrollView style={styles.optionsList} nestedScrollEnabled>
                {dates.map(date => (
                  <TouchableOpacity
                    key={date}
                    style={[
                      styles.optionItem,
                      selectedDate === date && { backgroundColor: colors.primary + '10' }
                    ]}
                    onPress={() => {
                      setSelectedDate(date);
                      setShowFilters(false);
                    }}
                  >
                    <Text style={[styles.optionItemText, { color: colors.text }]}>{date}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: viewMode === 'date' ? colors.primary : colors.background }
            ]}
            onPress={() => setViewMode('date')}
          >
            <Calendar size={18} color={viewMode === 'date' ? '#fff' : colors.text} />
            <Text style={[
              styles.toggleText,
              { color: viewMode === 'date' ? '#fff' : colors.text }
            ]}>By Date</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: viewMode === 'customer' ? colors.primary : colors.background }
            ]}
            onPress={() => setViewMode('customer')}
          >
            <User size={18} color={viewMode === 'customer' ? '#fff' : colors.text} />
            <Text style={[
              styles.toggleText,
              { color: viewMode === 'customer' ? '#fff' : colors.text }
            ]}>By Customer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.summaryBar, { backgroundColor: colors.surface }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Entries</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{filteredEntries.length}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>€{getTotalAmount().toFixed(2)}</Text>
        </View>
      </View>

      <FlatList
        data={filteredEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.lg }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Search size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No entries found</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Try a different search</Text>
          </View>
        }
      />

      <Modal
        visible={editingEntry !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setEditingEntry(null);
          setEditForm(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Entry</Text>
              <TouchableOpacity onPress={() => {
                setEditingEntry(null);
                setEditForm(null);
              }}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {editForm && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Date</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                      value={editForm.date}
                      onChangeText={(text) => setEditForm({ ...editForm, date: text })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  {editingEntry?.type === 'tiffin' ? (
                    <>
                      <View style={styles.formRow}>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                          <Text style={[styles.label, { color: colors.text }]}>Noon Qty</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                            value={editForm.noonQty}
                            onChangeText={(text) => setEditForm({ ...editForm, noonQty: text })}
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                          <Text style={[styles.label, { color: colors.text }]}>Evening Qty</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                            value={editForm.eveningQty}
                            onChangeText={(text) => setEditForm({ ...editForm, eveningQty: text })}
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      </View>

                      <View style={styles.formRow}>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                          <Text style={[styles.label, { color: colors.text }]}>Unit Price (€)</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                            value={editForm.unitPrice}
                            onChangeText={(text) => setEditForm({ ...editForm, unitPrice: text })}
                            keyboardType="decimal-pad"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                          <Text style={[styles.label, { color: colors.text }]}>Delivery (€)</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                            value={editForm.deliveryCharge}
                            onChangeText={(text) => setEditForm({ ...editForm, deliveryCharge: text })}
                            keyboardType="decimal-pad"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Delivery Charge (€)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                          value={editForm.deliveryCharge}
                          onChangeText={(text) => setEditForm({ ...editForm, deliveryCharge: text })}
                          keyboardType="decimal-pad"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>

                      <View style={styles.itemsHeader}>
                        <Text style={[styles.label, { color: colors.text }]}>Items</Text>
                        <TouchableOpacity
                          style={[styles.addItemButton, { backgroundColor: colors.primary }]}
                          onPress={addCateringItem}
                        >
                          <Text style={styles.addItemButtonText}>+ Add Item</Text>
                        </TouchableOpacity>
                      </View>

                      {editForm.items.map((item: any, index: number) => (
                        <View key={index} style={[styles.itemCard, { backgroundColor: colors.background }]}>
                          <View style={styles.itemHeader}>
                            <Text style={[styles.itemNumber, { color: colors.text }]}>Item {index + 1}</Text>
                            {editForm.items.length > 1 && (
                              <TouchableOpacity onPress={() => removeCateringItem(index)}>
                                <Trash2 size={18} color="#ef4444" />
                              </TouchableOpacity>
                            )}
                          </View>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, marginBottom: spacing.sm }]}
                            value={item.name}
                            onChangeText={(text) => updateCateringItem(index, 'name', text)}
                            placeholder="Item name"
                            placeholderTextColor={colors.textSecondary}
                          />
                          <View style={styles.formRow}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                              <Text style={[styles.label, { color: colors.text, fontSize: fontSize.xs }]}>Qty</Text>
                              <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                                value={item.qty}
                                onChangeText={(text) => updateCateringItem(index, 'qty', text)}
                                keyboardType="numeric"
                                placeholderTextColor={colors.textSecondary}
                              />
                            </View>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                              <Text style={[styles.label, { color: colors.text, fontSize: fontSize.xs }]}>Price (€)</Text>
                              <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                                value={item.unitPrice}
                                onChangeText={(text) => updateCateringItem(index, 'unitPrice', text)}
                                keyboardType="decimal-pad"
                                placeholderTextColor={colors.textSecondary}
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                    </>
                  )}

                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Comment</Text>
                    <TextInput
                      style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text }]}
                      value={editForm.comment}
                      onChangeText={(text) => setEditForm({ ...editForm, comment: text })}
                      placeholder="Add a comment (optional)"
                      multiline
                      numberOfLines={3}
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.background }]}
                onPress={() => {
                  setEditingEntry(null);
                  setEditForm(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveEdit}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  activeFilterBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  activeFilterText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  filtersContainer: {
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    maxHeight: 300,
  },
  filterOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  filterOptionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  optionsList: {
    maxHeight: 150,
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  optionItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  optionItemText: {
    fontSize: fontSize.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  toggleText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  summaryBar: {
    flexDirection: 'row',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  listContent: {
    padding: spacing.md,
  },
  entryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  dateText: {
    fontSize: fontSize.xs,
  },
  detailsRow: {
    marginTop: spacing.xs,
  },
  detailText: {
    fontSize: fontSize.sm,
  },
  totalValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
  },
  commentText: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    fontStyle: 'italic' as const,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    ...shadows.lg,
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
  modalBody: {
    padding: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  input: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    fontSize: fontSize.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addItemButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  itemCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemNumber: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
