import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Modal, Dimensions, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useState, useMemo, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Package, DollarSign, Truck, Calendar, X, PieChart as PieChartIcon, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { PieChart } from 'react-native-chart-kit';
import CalendarPicker from '@/components/CalendarPicker';
import { useTiffins } from '@/contexts/TiffinContext';
import { useCatering } from '@/contexts/CateringContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { getTodayDate, getYesterdayDate, getWeekStartDate, formatDisplayDate } from '@/utils/dateHelpers';
import { DashboardMetrics, DateFilter } from '@/types';

type FilterType = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'monthPicker';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { tiffins, calculateTiffinTotal } = useTiffins();
  const { orders, calculateOrderTotal } = useCatering();
  const { settings } = useSettings();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showMonthPickerModal, setShowMonthPickerModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    setStartDateText(customStartDate.toISOString().split('T')[0]);
    setEndDateText(customEndDate.toISOString().split('T')[0]);
  }, [customStartDate, customEndDate]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const dateFilter = useMemo((): DateFilter => {
    const today = getTodayDate();
    switch (filterType) {
      case 'today':
        return { type: 'today', startDate: today, endDate: today };
      case 'yesterday':
        const yesterday = getYesterdayDate();
        return { type: 'yesterday', startDate: yesterday, endDate: yesterday };
      case 'week':
        return { type: 'week', startDate: getWeekStartDate(), endDate: today };
      case 'month':
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        return { type: 'custom', startDate: monthStartStr, endDate: today };
      case 'monthPicker':
        const pickedMonthStart = new Date(selectedYear, selectedMonth, 1);
        const pickedMonthEnd = new Date(selectedYear, selectedMonth + 1, 0);
        const pickedStartStr = pickedMonthStart.toISOString().split('T')[0];
        const pickedEndStr = pickedMonthEnd.toISOString().split('T')[0];
        return { type: 'custom', startDate: pickedStartStr, endDate: pickedEndStr };
      case 'custom':
        const startStr = customStartDate.toISOString().split('T')[0];
        const endStr = customEndDate.toISOString().split('T')[0];
        return { type: 'custom', startDate: startStr, endDate: endStr };
      default:
        return { type: 'today', startDate: today, endDate: today };
    }
  }, [filterType, customStartDate, customEndDate, selectedYear, selectedMonth]);

  const metrics = useMemo((): DashboardMetrics => {
    const filteredTiffins = tiffins.filter(
      (t) => t.date >= dateFilter.startDate && t.date <= dateFilter.endDate
    );
    const filteredOrders = orders.filter(
      (o) => o.date >= dateFilter.startDate && o.date <= dateFilter.endDate
    );

    const totalTiffins = filteredTiffins.reduce((sum, t) => sum + t.noonQty + t.eveningQty, 0);
    const tiffinRevenue = filteredTiffins.reduce((sum, t) => sum + calculateTiffinTotal(t), 0);
    const deliveryFromTiffins = filteredTiffins.reduce((sum, t) => sum + t.deliveryCharge, 0);

    const cateringRevenue = filteredOrders.reduce((sum, o) => sum + calculateOrderTotal(o), 0);
    const deliveryFromCatering = filteredOrders.reduce((sum, o) => sum + o.deliveryCharge, 0);

    return {
      totalTiffins,
      totalRevenue: tiffinRevenue + cateringRevenue,
      deliveryTotal: deliveryFromTiffins + deliveryFromCatering,
      cateringOrders: filteredOrders.length,
      cateringRevenue,
    };
  }, [tiffins, orders, dateFilter, calculateTiffinTotal, calculateOrderTotal]);

  const previousMonthMetrics = useMemo(() => {
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevStartStr = prevMonthStart.toISOString().split('T')[0];
    const prevEndStr = prevMonthEnd.toISOString().split('T')[0];

    const prevTiffins = tiffins.filter(
      (t) => t.date >= prevStartStr && t.date <= prevEndStr
    );
    const prevOrders = orders.filter(
      (o) => o.date >= prevStartStr && o.date <= prevEndStr
    );

    const prevTiffinRevenue = prevTiffins.reduce((sum, t) => sum + calculateTiffinTotal(t), 0);
    const prevCateringRevenue = prevOrders.reduce((sum, o) => sum + calculateOrderTotal(o), 0);

    return {
      totalRevenue: prevTiffinRevenue + prevCateringRevenue,
      tiffinRevenue: prevTiffinRevenue,
      cateringRevenue: prevCateringRevenue,
    };
  }, [tiffins, orders, calculateTiffinTotal, calculateOrderTotal]);

  const FilterButton = ({ type, label }: { type: FilterType; label: string }) => {
    const isActive = filterType === type;
    return (
      <TouchableOpacity
        onPress={() => setFilterType(type)}
        style={[
          styles.filterButton,
          { backgroundColor: colors.background },
          isActive && { backgroundColor: colors.primary }
        ]}
      >
        <Text style={[
          styles.filterButtonText,
          { color: colors.textSecondary },
          isActive && { color: colors.surface }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const MetricCard = ({
    icon: Icon,
    label,
    value,
    color,
    delay,
  }: {
    icon: typeof TrendingUp;
    label: string;
    value: string;
    color: string;
    delay: number;
  }) => {
    const cardAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }).start();
    }, [cardAnim, delay]);

    return (
      <Animated.View
        style={[
          styles.metricCard,
          { backgroundColor: colors.surface },
          {
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Icon size={24} color={color} />
        </View>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={[colors.gradient.start, colors.gradient.end]}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <Logo size="small" showText={false} />
          <ThemeToggle />
        </View>
        <Text style={[styles.headerTitle, { color: colors.surface }]}>Sai&apos;s Kitchen</Text>
        <Text style={[styles.headerSubtitle, { color: colors.surface }]}>Tiffin Tracker & Invoicing</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.filterRow}>
            <Calendar size={20} color={colors.text} />
            <Text style={[styles.filterTitle, { color: colors.text }]}>Period</Text>
          </View>
          <View style={styles.filterButtons}>
            <FilterButton type="today" label="Today" />
            <FilterButton type="yesterday" label="Yesterday" />
            <FilterButton type="week" label="Week" />
          </View>
          <View style={styles.filterButtons}>
            <FilterButton type="month" label="This Month" />
            <TouchableOpacity
              onPress={() => setShowMonthPickerModal(true)}
              style={[
                styles.filterButton,
                { backgroundColor: colors.background },
                filterType === 'monthPicker' && { backgroundColor: colors.primary }
              ]}
            >
              <Text style={[
                styles.filterButtonText,
                { color: colors.textSecondary },
                filterType === 'monthPicker' && { color: colors.surface }
              ]}>
                Month Range
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              onPress={() => setShowCustomModal(true)}
              style={[
                styles.filterButton,
                { backgroundColor: colors.background },
                filterType === 'custom' && { backgroundColor: colors.primary }
              ]}
            >
              <Text style={[
                styles.filterButtonText,
                { color: colors.textSecondary },
                filterType === 'custom' && { color: colors.surface }
              ]}>
                Custom Date
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.dateRange, { color: colors.textSecondary }]}>
            {formatDisplayDate(dateFilter.startDate)}
            {dateFilter.startDate !== dateFilter.endDate &&
              ` - ${formatDisplayDate(dateFilter.endDate)}`}
          </Text>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            icon={DollarSign}
            label="Total Revenue"
            value={formatCurrency(metrics.totalRevenue, settings.currency)}
            color={colors.success}
            delay={0}
          />
          <MetricCard
            icon={Package}
            label="Tiffins Delivered"
            value={metrics.totalTiffins.toString()}
            color={colors.primary}
            delay={100}
          />
          <MetricCard
            icon={TrendingUp}
            label="Catering Orders"
            value={metrics.cateringOrders.toString()}
            color={colors.secondary}
            delay={200}
          />
          <MetricCard
            icon={Truck}
            label="Delivery Charges"
            value={formatCurrency(metrics.deliveryTotal, settings.currency)}
            color={colors.warning}
            delay={300}
          />
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryHeader}>
            <PieChartIcon size={20} color={colors.primary} />
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Revenue Breakdown</Text>
          </View>
          
          {metrics.totalRevenue > 0 && (
            <View style={styles.chartContainer}>
              <PieChart
                data={[
                  {
                    name: 'Tiffin',
                    amount: metrics.totalRevenue - metrics.cateringRevenue,
                    color: colors.primary,
                    legendFontColor: colors.text,
                    legendFontSize: 14,
                  },
                  {
                    name: 'Catering',
                    amount: metrics.cateringRevenue,
                    color: colors.secondary,
                    legendFontColor: colors.text,
                    legendFontSize: 14,
                  },
                ]}
                width={Dimensions.get('window').width - spacing.lg * 4}
                height={180}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          )}

          <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Tiffin Sales</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(metrics.totalRevenue - metrics.cateringRevenue, settings.currency)}
            </Text>
          </View>
          <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Catering Sales</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(metrics.cateringRevenue, settings.currency)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: colors.primary }]}>
            <Text style={[styles.summaryTotalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.summaryTotalValue, { color: colors.primary }]}>
              {formatCurrency(metrics.totalRevenue, settings.currency)}
            </Text>
          </View>
        </View>

        <View style={[styles.comparisonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Comparison with Last Month</Text>
          <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Last Month Total</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(previousMonthMetrics.totalRevenue, settings.currency)}
            </Text>
          </View>
          <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Current Period</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(metrics.totalRevenue, settings.currency)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: colors.primary }]}>
            <Text style={[styles.summaryTotalLabel, { color: colors.text }]}>Difference</Text>
            <Text style={[
              styles.summaryTotalValue,
              { color: metrics.totalRevenue >= previousMonthMetrics.totalRevenue ? colors.success : colors.error }
            ]}>
              {metrics.totalRevenue >= previousMonthMetrics.totalRevenue ? '+' : ''}
              {formatCurrency(metrics.totalRevenue - previousMonthMetrics.totalRevenue, settings.currency)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Custom Period</Text>
              <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerSection}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>Start Date</Text>
              <TextInput
                style={[
                  styles.dateInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: dateError ? colors.error : colors.border,
                    color: colors.text
                  }
                ]}
                value={startDateText}
                onChangeText={(text) => {
                  setStartDateText(text);
                  setDateError('');
                  if (text.length === 10) {
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(text)) {
                      setDateError('Invalid format. Use YYYY-MM-DD');
                      return;
                    }
                    const [year, month, day] = text.split('-').map(Number);
                    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
                      setDateError('Invalid date');
                      return;
                    }
                    const date = new Date(year, month - 1, day);
                    if (!isNaN(date.getTime())) {
                      setCustomStartDate(date);
                    }
                  }
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              <Text style={[styles.dateLabel, { color: colors.text, marginTop: spacing.md }]}>End Date</Text>
              <TextInput
                style={[
                  styles.dateInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: dateError ? colors.error : colors.border,
                    color: colors.text
                  }
                ]}
                value={endDateText}
                onChangeText={(text) => {
                  setEndDateText(text);
                  setDateError('');
                  if (text.length === 10) {
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(text)) {
                      setDateError('Invalid format. Use YYYY-MM-DD');
                      return;
                    }
                    const [year, month, day] = text.split('-').map(Number);
                    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
                      setDateError('Invalid date');
                      return;
                    }
                    const date = new Date(year, month - 1, day);
                    if (!isNaN(date.getTime())) {
                      setCustomEndDate(date);
                    }
                  }
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
              {dateError ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{dateError}</Text>
              ) : null}
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>Example: 2025-10-03</Text>
            </View>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (dateError || startDateText.length !== 10 || endDateText.length !== 10) {
                  setDateError('Please enter valid dates');
                  return;
                }
                setFilterType('custom');
                setShowCustomModal(false);
              }}
            >
              <Text style={[styles.applyButtonText, { color: colors.surface }]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showMonthPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPickerModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.yearSelector}>
              <TouchableOpacity
                onPress={() => setSelectedYear(selectedYear - 1)}
                style={[styles.yearButton, { backgroundColor: colors.background }]}
              >
                <ChevronLeft size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.yearText, { color: colors.text }]}>{selectedYear}</Text>
              <TouchableOpacity
                onPress={() => setSelectedYear(selectedYear + 1)}
                style={[styles.yearButton, { backgroundColor: colors.background }]}
                disabled={selectedYear >= new Date().getFullYear()}
              >
                <ChevronRight size={24} color={selectedYear >= new Date().getFullYear() ? colors.textSecondary : colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {[
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
              ].map((month, index) => {
                const isSelected = selectedMonth === index && filterType === 'monthPicker';
                const isFuture = selectedYear === new Date().getFullYear() && index > new Date().getMonth();
                return (
                  <TouchableOpacity
                    key={month}
                    disabled={isFuture}
                    onPress={() => {
                      setSelectedMonth(index);
                      setFilterType('monthPicker');
                      setShowMonthPickerModal(false);
                    }}
                    style={[
                      styles.monthButton,
                      { backgroundColor: colors.background },
                      isSelected && { backgroundColor: colors.primary },
                      isFuture && { opacity: 0.3 }
                    ]}
                  >
                    <Text style={[
                      styles.monthButtonText,
                      { color: colors.text },
                      isSelected && { color: colors.surface }
                    ]}>
                      {month}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={showDatePicker !== null}
        date={tempDate}
        onDateChange={setTempDate}
        onConfirm={() => {
          if (showDatePicker === 'start') {
            setCustomStartDate(tempDate);
          } else if (showDatePicker === 'end') {
            setCustomEndDate(tempDate);
          }
          setShowDatePicker(null);
        }}
        onCancel={() => setShowDatePicker(null)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: fontSize.md,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  filterContainer: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: -spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    ...shadows.md,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  dateRange: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  metricLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  summaryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    ...shadows.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  comparisonCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    ...shadows.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  summaryLabel: {
    fontSize: fontSize.md,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  summaryTotal: {
    borderBottomWidth: 0,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 2,
  },
  summaryTotalLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  summaryTotalValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  datePickerSection: {
    marginBottom: spacing.lg,
  },
  dateLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  dateInput: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: fontSize.md,
  },
  applyButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  errorText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  hintText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  yearButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  yearText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    minWidth: 80,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  monthButton: {
    width: '30%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
