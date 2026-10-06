import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Package, UtensilsCrossed, List } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';

export default function EntriesScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;

  const EntryTypeCard = ({
    icon: Icon,
    title,
    description,
    color,
    onPress,
  }: {
    icon: typeof Package;
    title: string;
    description: string;
    color: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Icon size={32} color={color} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <Plus size={24} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Entry</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Choose entry type</Text>
        </View>
        <TouchableOpacity 
          style={[styles.viewEntriesButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/view-entries')}
        >
          <List size={20} color={colors.surface} />
          <Text style={[styles.viewEntriesText, { color: colors.surface }]}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <EntryTypeCard
          icon={Package}
          title="Tiffin Entry"
          description="Record daily tiffin delivery with noon and evening quantities"
          color={colors.primary}
          onPress={() => router.push('/add-tiffin')}
        />
        <EntryTypeCard
          icon={UtensilsCrossed}
          title="Catering Order"
          description="Create party or catering order with multiple items"
          color={colors.secondary}
          onPress={() => router.push('/add-catering')}
        />
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
    paddingVertical: spacing.lg,
  },
  viewEntriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  viewEntriesText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
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
    lineHeight: 20,
  },
});
