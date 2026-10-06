import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useMemo } from 'react';
import { FileDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCustomers } from '@/contexts/CustomerContext';
import { useTiffins } from '@/contexts/TiffinContext';
import { useCatering } from '@/contexts/CateringContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { formatDisplayDate } from '@/utils/dateHelpers';

interface CustomerOutstanding {
  customerId: string;
  customerName: string;
  tiffinAmount: number;
  cateringAmount: number;
  grandTotal: number;
}

export default function OutstandingReportScreen() {
  const { getCustomerById } = useCustomers();
  const { tiffins, calculateTiffinTotal } = useTiffins();
  const { orders, calculateOrderTotal } = useCatering();
  const { settings } = useSettings();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;

  const now = new Date();
  const [filterMode, setFilterMode] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const monthStart = useMemo(() => {
    if (filterMode === 'custom' && customStartDate) {
      return customStartDate;
    }
    const year = selectedMonth.getFullYear();
    const month = String(selectedMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }, [filterMode, selectedMonth, customStartDate]);

  const monthEnd = useMemo(() => {
    if (filterMode === 'custom' && customEndDate) {
      return customEndDate;
    }
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(lastDay).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  }, [filterMode, selectedMonth, customEndDate]);

  const outstandingData = useMemo((): CustomerOutstanding[] => {
    const customerMap = new Map<string, CustomerOutstanding>();

    const filteredTiffins = tiffins.filter(
      (t) => t.date >= monthStart && t.date <= monthEnd
    );

    const filteredOrders = orders.filter(
      (o) => o.date >= monthStart && o.date <= monthEnd
    );

    filteredTiffins.forEach((tiffin) => {
      const customer = getCustomerById(tiffin.customerId);
      if (!customer) return;

      if (!customerMap.has(tiffin.customerId)) {
        customerMap.set(tiffin.customerId, {
          customerId: tiffin.customerId,
          customerName: customer.name,
          tiffinAmount: 0,
          cateringAmount: 0,
          grandTotal: 0,
        });
      }

      const data = customerMap.get(tiffin.customerId)!;
      data.tiffinAmount += calculateTiffinTotal(tiffin);
    });

    filteredOrders.forEach((order) => {
      const customer = getCustomerById(order.customerId);
      if (!customer) return;

      if (!customerMap.has(order.customerId)) {
        customerMap.set(order.customerId, {
          customerId: order.customerId,
          customerName: customer.name,
          tiffinAmount: 0,
          cateringAmount: 0,
          grandTotal: 0,
        });
      }

      const data = customerMap.get(order.customerId)!;
      data.cateringAmount += calculateOrderTotal(order);
    });

    customerMap.forEach((data) => {
      data.grandTotal = data.tiffinAmount + data.cateringAmount;
    });

    return Array.from(customerMap.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [tiffins, orders, monthStart, monthEnd, getCustomerById, calculateTiffinTotal, calculateOrderTotal]);

  const totalOutstanding = useMemo(() => {
    return outstandingData.reduce((sum, item) => sum + item.grandTotal, 0);
  }, [outstandingData]);

  const generatePDFHTML = () => {
    const periodText = filterMode === 'custom' && customStartDate && customEndDate
      ? `${formatDisplayDate(customStartDate)} to ${formatDisplayDate(customEndDate)}`
      : selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthName = periodText;

    let tableRows = '';
    outstandingData.forEach((item, index) => {
      tableRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.customerName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.tiffinAmount, settings.currency)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.cateringAmount, settings.currency)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.grandTotal, settings.currency)}</td>
        </tr>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1f2937; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #f97316; }
            .logo-section { display: flex; align-items: center; gap: 16px; }
            .logo { width: 80px; height: 80px; }
            .company-info h1 { font-size: 28px; color: #f97316; margin-bottom: 8px; }
            .company-info p { font-size: 14px; color: #6b7280; margin: 2px 0; }
            .report-info { text-align: right; }
            .report-info h2 { font-size: 24px; color: #1f2937; margin-bottom: 8px; }
            .report-info p { font-size: 14px; color: #6b7280; margin: 2px 0; }
            .summary-box { background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
            .summary-box h3 { font-size: 18px; color: #92400e; margin-bottom: 8px; }
            .summary-box .amount { font-size: 32px; font-weight: 700; color: #f97316; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f97316; color: white; padding: 12px; text-align: left; font-weight: 600; font-size: 14px; }
            td { font-size: 14px; color: #4b5563; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/zatop184vuk21k40jn3mc" class="logo" />
              <div class="company-info">
                <h1>${settings.companyName}</h1>
                <p>${settings.companyPhone}</p>
                <p>${settings.companyAddress}</p>
              </div>
            </div>
            <div class="report-info">
              <h2>OUTSTANDING REPORT</h2>
              <p><strong>Period:</strong> ${monthName}</p>
              <p><strong>Generated:</strong> ${formatDisplayDate(new Date().toISOString().split('T')[0])}</p>
              <p><strong>Total Customers:</strong> ${outstandingData.length}</p>
            </div>
          </div>

          <div class="summary-box">
            <h3>Total Outstanding Amount</h3>
            <div class="amount">${formatCurrency(totalOutstanding, settings.currency)}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center;">Sr No.</th>
                <th>Customer Name</th>
                <th style="text-align: right;">Tiffin Amount</th>
                <th style="text-align: right;">Catering Amount</th>
                <th style="text-align: right;">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            <p>Generated by ${settings.companyName}</p>
            <p>For any queries, please contact ${settings.companyPhone}</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleExportPDF = async () => {
    if (outstandingData.length === 0) {
      Alert.alert('No Data', 'No outstanding amounts found for this period');
      return;
    }

    try {
      setIsGenerating(true);
      const html = generatePDFHTML();
      
      const { uri } = await Print.printToFileAsync({ html });
      console.log('PDF generated at:', uri);

      const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = uri;
        link.download = `outstanding-report-${monthName.replace(' ', '-')}.pdf`;
        link.click();
        Alert.alert('Success', 'Report downloaded successfully!');
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Outstanding Report - ${monthName}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Success', `Report saved to: ${uri}`);
        }
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Outstanding Report',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.periodCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.periodHeader}>
              <Calendar size={20} color={colors.primary} />
              <Text style={[styles.periodTitle, { color: colors.text }]}>Select Period</Text>
            </View>
            
            <View style={styles.filterModeContainer}>
              <TouchableOpacity
                style={[
                  styles.filterModeButton,
                  { borderColor: colors.border },
                  filterMode === 'month' && { backgroundColor: colors.primary }
                ]}
                onPress={() => setFilterMode('month')}
              >
                <Text style={[
                  styles.filterModeText,
                  { color: filterMode === 'month' ? colors.surface : colors.text }
                ]}>
                  Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterModeButton,
                  { borderColor: colors.border },
                  filterMode === 'custom' && { backgroundColor: colors.primary }
                ]}
                onPress={() => setFilterMode('custom')}
              >
                <Text style={[
                  styles.filterModeText,
                  { color: filterMode === 'custom' ? colors.surface : colors.text }
                ]}>
                  Custom Range
                </Text>
              </TouchableOpacity>
            </View>

            {filterMode === 'month' ? (
              <>
                <View style={styles.yearSelector}>
                  <TouchableOpacity
                    style={[styles.yearButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => setSelectedYear(prev => prev - 1)}
                  >
                    <ChevronLeft size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.yearText, { color: colors.text }]}>{selectedYear}</Text>
                  <TouchableOpacity
                    style={[styles.yearButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => setSelectedYear(prev => prev + 1)}
                  >
                    <ChevronRight size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.monthGrid}>
                  {Array.from({ length: 12 }, (_, i) => {
                    const monthDate = new Date(selectedYear, i, 1);
                    const isSelected = selectedMonth.getMonth() === i && selectedMonth.getFullYear() === selectedYear;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.monthGridItem,
                          { backgroundColor: colors.background, borderColor: colors.border },
                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setSelectedMonth(monthDate)}
                      >
                        <Text style={[
                          styles.monthGridText,
                          { color: isSelected ? colors.surface : colors.text }
                        ]}>
                          {monthDate.toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.customRangeContainer}>
                <View style={styles.dateInputContainer}>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Start Date</Text>
                  <TextInput
                    style={[
                      styles.dateInput,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }
                    ]}
                    value={customStartDate}
                    onChangeText={setCustomStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="default"
                  />
                </View>
                <View style={styles.dateInputContainer}>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>End Date</Text>
                  <TextInput
                    style={[
                      styles.dateInput,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }
                    ]}
                    value={customEndDate}
                    onChangeText={setCustomEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="default"
                  />
                </View>
              </View>
            )}
          </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Customers:</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{outstandingData.length}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.primary }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total Outstanding:</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {formatCurrency(totalOutstanding, settings.currency)}
            </Text>
          </View>
        </View>

        {outstandingData.length > 0 ? (
          <>
            <View style={[styles.tableCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                <Text style={[styles.headerCell, styles.srNoCell, { color: colors.surface }]}>Sr</Text>
                <Text style={[styles.headerCell, styles.nameCell, { color: colors.surface }]}>Customer</Text>
                <Text style={[styles.headerCell, styles.amountCell, { color: colors.surface }]}>Tiffin</Text>
                <Text style={[styles.headerCell, styles.amountCell, { color: colors.surface }]}>Catering</Text>
                <Text style={[styles.headerCell, styles.amountCell, { color: colors.surface }]}>Total</Text>
              </View>
              {outstandingData.map((item, index) => (
                <View
                  key={item.customerId}
                  style={[styles.tableRow, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.cell, styles.srNoCell, { color: colors.textSecondary }]}>
                    {index + 1}
                  </Text>
                  <Text style={[styles.cell, styles.nameCell, { color: colors.text }]}>
                    {item.customerName}
                  </Text>
                  <Text style={[styles.cell, styles.amountCell, { color: colors.text }]}>
                    {formatCurrency(item.tiffinAmount, settings.currency)}
                  </Text>
                  <Text style={[styles.cell, styles.amountCell, { color: colors.text }]}>
                    {formatCurrency(item.cateringAmount, settings.currency)}
                  </Text>
                  <Text style={[styles.cell, styles.amountCell, styles.totalCell, { color: colors.primary }]}>
                    {formatCurrency(item.grandTotal, settings.currency)}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: colors.primary, opacity: isGenerating ? 0.6 : 1 }]}
              onPress={handleExportPDF}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <FileDown size={20} color={colors.surface} />
                  <Text style={[styles.exportButtonText, { color: colors.surface }]}>Export PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No outstanding amounts for this period
            </Text>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  periodCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    ...shadows.md,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  periodTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  monthButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  summaryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    ...shadows.md,
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: fontSize.md,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  totalRow: {
    borderTopWidth: 2,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  totalLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  totalValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  tableCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  cell: {
    fontSize: fontSize.sm,
  },
  srNoCell: {
    width: 40,
    textAlign: 'center' as const,
  },
  nameCell: {
    flex: 1,
  },
  amountCell: {
    width: 80,
    textAlign: 'right' as const,
  },
  totalCell: {
    fontWeight: fontWeight.semibold,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  exportButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
  },
  filterModeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterModeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterModeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  yearButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  yearText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    minWidth: 80,
    textAlign: 'center' as const,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  monthGridItem: {
    width: '23%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  monthGridText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  customRangeContainer: {
    gap: spacing.md,
  },
  dateInputContainer: {
    gap: spacing.xs,
  },
  dateLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  dateInput: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: fontSize.md,
  },
});
