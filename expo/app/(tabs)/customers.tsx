import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Platform, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus, Phone, MapPin, User, Edit2, Trash2 } from 'lucide-react-native';
import { useCustomers } from '@/contexts/CustomerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { Customer } from '@/types';

export default function CustomersScreen() {
  const insets = useSafeAreaInsets();
  const { customers, searchCustomers, deleteCustomer } = useCustomers();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const [searchQuery, setSearchQuery] = useState('');

  const displayCustomers = searchQuery ? searchCustomers(searchQuery) : customers;

  const handleDelete = (customer: Customer) => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${customer.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomer(customer.id);
              Alert.alert('Success', 'Customer deleted successfully');
            } catch (error) {
              console.error('Failed to delete customer:', error);
              Alert.alert('Error', 'Failed to delete customer');
            }
          },
        },
      ]
    );
  };

  const CustomerCard = ({ customer }: { customer: Customer }) => (
    <View style={[styles.customerCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.customerIcon, { backgroundColor: colors.primary + '20' }]}>
        <User size={24} color={colors.primary} />
      </View>
      <View style={styles.customerInfo}>
        <Text style={[styles.customerName, { color: colors.text }]}>{customer.name}</Text>
        <View style={styles.customerDetail}>
          <Phone size={14} color={colors.textSecondary} />
          <Text style={[styles.customerDetailText, { color: colors.textSecondary }]}>{customer.phone}</Text>
        </View>
        {customer.address && (
          <View style={styles.customerDetail}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={[styles.customerDetailText, { color: colors.textSecondary }]} numberOfLines={1}>
              {customer.address}
            </Text>
          </View>
        )}
        <View style={[
          styles.badge,
          { backgroundColor: customer.type === 'Regular' ? colors.successLight : colors.warningLight }
        ]}>
          <Text style={[styles.badgeText, { color: colors.text }]}>{customer.type}</Text>
        </View>
      </View>
      <View style={styles.customerActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
          onPress={() => router.push(`/add-customer?id=${customer.id}` as any)}
        >
          <Edit2 size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
          onPress={() => handleDelete(customer)}
        >
          <Trash2 size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Customers</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/add-customer')}
        >
          <Plus size={24} color={colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Search size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <FlatList
        data={displayCustomers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CustomerCard customer={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <User size={64} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No customers yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Add your first customer to get started</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: fontSize.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  customerCard: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  customerIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  customerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  customerDetailText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  customerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
});
