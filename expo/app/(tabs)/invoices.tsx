import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Plus, FileBarChart } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Invoices</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/generate-invoice')}
        >
          <Plus size={24} color={colors.surface} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/generate-invoice')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
            <FileText size={32} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Generate Invoice</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Create a new invoice for a customer
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/outstanding-report')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.secondary + '20' }]}>
            <FileBarChart size={32} color={colors.secondary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Outstanding Report</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              View monthly outstanding amounts by customer
            </Text>
          </View>
        </TouchableOpacity>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadows.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    fontSize: fontSize.sm,
  },
});
