import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, ActivityIndicator, KeyboardAvoidingView, Modal, TextInput, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useState, useMemo } from 'react';
import { FileText, Download, Calendar, X, CalendarDays, CheckCircle2, Circle, Search, ChevronDown } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import { useCustomers } from '@/contexts/CustomerContext';
import { useTiffins } from '@/contexts/TiffinContext';
import { useCatering } from '@/contexts/CateringContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { getTodayDate, formatDisplayDate } from '@/utils/dateHelpers';

export default function GenerateInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const { customers, getCustomerById } = useCustomers();
  const { getTiffinsByCustomer, calculateTiffinTotal } = useTiffins();
  const { orders: allOrders, getOrdersByCustomer, calculateOrderTotal } = useCatering();
  
  console.log('Generate Invoice - Total catering orders in system:', allOrders.length);
  const { settings } = useSettings();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  
  const [customerId, setCustomerId] = useState('');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(getTodayDate());
  const [tempEndDate, setTempEndDate] = useState(getTodayDate());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [invoiceType, setInvoiceType] = useState<'combined' | 'tiffin' | 'catering'>('combined');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const customer = customerId ? getCustomerById(customerId) : null;

  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery) return customers;
    const query = customerSearchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.phone.includes(query)
    );
  }, [customers, customerSearchQuery]);
  const customerTiffins = customer ? getTiffinsByCustomer(customerId)
    .filter((t) => t.date >= startDate && t.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date)) : [];
  const customerOrders = customer ? getOrdersByCustomer(customerId)
    .filter((o) => o.date >= startDate && o.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date)) : [];

  console.log('Generate Invoice - Customer ID:', customerId);
  console.log('Generate Invoice - Date Range:', startDate, 'to', endDate);
  console.log('Generate Invoice - All Orders for Customer:', customer ? getOrdersByCustomer(customerId).length : 0);
  console.log('Generate Invoice - Filtered Orders:', customerOrders.length);
  console.log('Generate Invoice - Orders:', customerOrders);

  const tiffinTotal = customerTiffins.reduce((sum, t) => sum + calculateTiffinTotal(t), 0);
  const cateringTotal = customerOrders.reduce((sum, o) => sum + calculateOrderTotal(o), 0);
  const grandTotal = tiffinTotal + cateringTotal;

  const escapeHtml = (text: string | undefined): string => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const generateInvoiceHTML = () => {
    const invoiceNumber = `INV-${Date.now()}`;
    const invoiceDate = formatDisplayDate(getTodayDate());

    const includeTiffin = invoiceType === 'combined' || invoiceType === 'tiffin';
    const includeCatering = invoiceType === 'combined' || invoiceType === 'catering';

    let tiffinRows = '';
    if (includeTiffin) {
      customerTiffins.forEach((tiffin) => {
        const total = calculateTiffinTotal(tiffin);
        tiffinRows += `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${formatDisplayDate(tiffin.date)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${tiffin.noonQty}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${tiffin.eveningQty}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(tiffin.unitPrice, settings.currency)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(tiffin.deliveryCharge, settings.currency)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(total, settings.currency)}</td>
          </tr>
        `;
      });
    }

    let cateringRows = '';
    if (includeCatering) {
      customerOrders.forEach((order) => {
        order.items.forEach((item, idx) => {
          const itemTotal = item.qty * item.unitPrice;
          cateringRows += `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${idx === 0 ? formatDisplayDate(order.date) : ''}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.itemName}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.qty}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unitPrice, settings.currency)}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(itemTotal, settings.currency)}</td>
            </tr>
          `;
        });
        if (order.deliveryCharge > 0) {
          cateringRows += `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;" colspan="4">Delivery Charge</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(order.deliveryCharge, settings.currency)}</td>
            </tr>
          `;
        }
      });
    }

    const displayTiffinTotal = includeTiffin ? tiffinTotal : 0;
    const displayCateringTotal = includeCatering ? cateringTotal : 0;
    const displayGrandTotal = displayTiffinTotal + displayCateringTotal;

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
            .invoice-info { text-align: right; }
            .invoice-info h2 { font-size: 24px; color: #1f2937; margin-bottom: 8px; }
            .invoice-info p { font-size: 14px; color: #6b7280; margin: 2px 0; }
            .customer-section { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .customer-section h3 { font-size: 16px; color: #1f2937; margin-bottom: 8px; }
            .customer-section p { font-size: 14px; color: #4b5563; margin: 2px 0; }
            .section-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 30px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f97316; color: white; padding: 12px; text-align: left; font-weight: 600; font-size: 14px; }
            td { font-size: 14px; color: #4b5563; }
            .totals { margin-top: 30px; }
            .total-row { display: flex; justify-content: space-between; padding: 12px 20px; font-size: 16px; }
            .total-row.subtotal { background: #f9fafb; }
            .total-row.grand { background: #f97316; color: white; font-size: 20px; font-weight: 700; margin-top: 8px; border-radius: 8px; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
            .notes { background: #fef3c7; padding: 16px; border-radius: 8px; margin-top: 20px; font-size: 14px; color: #92400e; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <img src="https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/zatop184vuk21k40jn3mc" class="logo" />
              <div class="company-info">
                <h1>${escapeHtml(settings.companyName)}</h1>
                <p>${escapeHtml(settings.companyPhone)}</p>
                <p>${escapeHtml(settings.companyAddress)}</p>
              </div>
            </div>
            <div class="invoice-info">
              <h2>INVOICE</h2>
              <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
              <p><strong>Date:</strong> ${invoiceDate}</p>
              <p><strong>Period:</strong> ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}</p>
            </div>
          </div>

          <div class="customer-section">
            <h3>Bill To:</h3>
            <p><strong>${escapeHtml(customer?.name)}</strong></p>
            <p>${escapeHtml(customer?.phone)}</p>
            ${customer?.address ? `<p>${escapeHtml(customer.address)}</p>` : ''}
          </div>

          ${includeTiffin && customerTiffins.length > 0 ? `
            <h3 class="section-title">Tiffin Services</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style="text-align: center;">Noon Qty</th>
                  <th style="text-align: center;">Evening Qty</th>
                  <th style="text-align: right;">Unit Price</th>
                  <th style="text-align: right;">Delivery</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${tiffinRows}
              </tbody>
            </table>
          ` : ''}

          ${includeCatering && customerOrders.length > 0 ? `
            <h3 class="section-title">Catering Services</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Unit Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${cateringRows}
              </tbody>
            </table>
          ` : ''}

          <div class="totals">
            ${includeTiffin && customerTiffins.length > 0 && invoiceType === 'combined' ? `
              <div class="total-row subtotal">
                <span>Tiffin Subtotal:</span>
                <strong>${formatCurrency(displayTiffinTotal, settings.currency)}</strong>
              </div>
            ` : ''}
            ${includeCatering && customerOrders.length > 0 && invoiceType === 'combined' ? `
              <div class="total-row subtotal">
                <span>Catering Subtotal:</span>
                <strong>${formatCurrency(displayCateringTotal, settings.currency)}</strong>
              </div>
            ` : ''}
            <div class="total-row grand">
              <span>GRAND TOTAL:</span>
              <strong>${formatCurrency(displayGrandTotal, settings.currency)}</strong>
            </div>
          </div>

          <div class="notes">
            <strong>Payment Details:</strong><br/>
            <strong>BIC:</strong> TRWIBEB1XXX<br/>
            <strong>IBAN:</strong> BE40 9676 8333 5963<br/>
            <br/>
            <strong>Note:</strong> Thank you for your business! Payment is due within 7 days.
          </div>

          <div class="footer">
            <p>Generated by ${escapeHtml(settings.companyName)} • ${invoiceDate}</p>
            <p>For any queries, please contact ${escapeHtml(settings.companyPhone)}</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleGenerateInvoice = async () => {
    if (!customerId) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    if (invoiceType === 'tiffin' && customerTiffins.length === 0) {
      Alert.alert('No Data', 'No tiffin entries found for this period');
      return;
    }

    if (invoiceType === 'catering' && customerOrders.length === 0) {
      Alert.alert('No Data', 'No catering orders found for this period');
      return;
    }

    if (invoiceType === 'combined' && customerTiffins.length === 0 && customerOrders.length === 0) {
      Alert.alert('No Data', 'No tiffin entries or catering orders found for this period');
      return;
    }

    try {
      setIsGenerating(true);
      console.log('Starting invoice generation...');
      console.log('Customer:', customer);
      console.log('Invoice type:', invoiceType);
      console.log('Date range:', startDate, 'to', endDate);
      console.log('Platform:', Platform.OS);
      
      const html = generateInvoiceHTML();
      console.log('HTML generated, length:', html.length);
      
      const sanitizedCustomerName = customer?.name.replace(/[^a-zA-Z0-9 ]/g, '_') || 'customer';
      const invoiceTypeLabel = invoiceType === 'combined' ? 'Combined' : invoiceType === 'tiffin' ? 'Tiffin' : 'Catering';
      const filename = `${sanitizedCustomerName}_${invoiceTypeLabel}_Invoice_${getTodayDate()}.pdf`;
      console.log('Filename:', filename);
      
      if (Platform.OS === 'web') {
        console.log('Web platform detected, using direct HTML approach');
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          throw new Error('Failed to open print window. Please allow pop-ups for this site.');
        }
        
        printWindow.document.write(html);
        printWindow.document.close();
        
        setTimeout(() => {
          printWindow.print();
        }, 500);
        
        Alert.alert('Success', 'Invoice opened in new window. Please use browser print to save as PDF.');
        return;
      }
      
      console.log('Native platform, calling Print.printToFileAsync...');
      console.log('HTML preview (first 500 chars):', html.substring(0, 500));
      
      let result;
      try {
        result = await Print.printToFileAsync({ 
          html,
          base64: false 
        });
        console.log('Print result:', JSON.stringify(result, null, 2));
      } catch (printError: any) {
        console.error('Print.printToFileAsync error:', printError);
        console.error('Print error message:', printError?.message);
        console.error('Print error stack:', printError?.stack);
        throw new Error(`PDF generation failed: ${printError?.message || 'Unknown print error'}`);
      }
      
      if (!result || !result.uri) {
        console.error('Invalid result from Print.printToFileAsync:', result);
        throw new Error('PDF generation failed - no URI returned. Please check the console for details.');
      }
      
      const { uri } = result;
      console.log('PDF generated at:', uri);
      console.log('File exists check:', await FileSystem.getInfoAsync(uri));

      {
        const docDir = (FileSystem as any).documentDirectory;
        if (!docDir) {
          throw new Error('Document directory not available');
        }
        const newUri = `${docDir}${filename}`;
        console.log('Copying from:', uri, 'to:', newUri);
        
        await FileSystem.copyAsync({
          from: uri,
          to: newUri
        });
        console.log('PDF copied to:', newUri);
        console.log('Final file check:', await FileSystem.getInfoAsync(newUri));
        
        const canShare = await Sharing.isAvailableAsync();
        console.log('Can share:', canShare);
        
        if (canShare) {
          await Sharing.shareAsync(newUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Invoice - ${customer?.name}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Success', `Invoice saved as: ${filename}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to generate invoice:', error);
      console.error('Error details:', error?.message || error?.toString());
      console.error('Error stack:', error?.stack);
      
      const errorMessage = error?.message || 'Unknown error occurred';
      Alert.alert(
        'Error', 
        `Failed to generate invoice: ${errorMessage}\n\nPlease check the console for details.`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.wrapper, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: 'Generate Invoice',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Customer *</Text>
          <TouchableOpacity
            style={[styles.customerSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowCustomerSearch(true)}
          >
            <Text style={[styles.customerSelectorText, { color: customer ? colors.text : colors.textSecondary }]}>
              {customer ? customer.name : 'Select customer...'}
            </Text>
            <ChevronDown size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Modal
          visible={showCustomerSearch}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCustomerSearch(false)}
        >
          <View style={styles.customerModalOverlay}>
            <View style={[styles.customerModalContent, { backgroundColor: colors.background }]}>
              <View style={styles.customerModalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Customer</Text>
                <TouchableOpacity onPress={() => {
                  setShowCustomerSearch(false);
                  setCustomerSearchQuery('');
                }}>
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
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.customerSearchItem, { backgroundColor: customerId === item.id ? colors.primary + '15' : colors.surface }]}
                    onPress={() => {
                      setCustomerId(item.id);
                      setShowCustomerSearch(false);
                      setCustomerSearchQuery('');
                    }}
                  >
                    <View style={styles.customerSearchItemContent}>
                      <Text style={[styles.customerSearchItemName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.customerSearchItemPhone, { color: colors.textSecondary }]}>{item.phone}</Text>
                    </View>
                    {customerId === item.id && (
                      <CheckCircle2 size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.customerSearchList}
                ListEmptyComponent={
                  <View style={styles.emptySearchState}>
                    <Text style={[styles.emptySearchText, { color: colors.textSecondary }]}>No customers found</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Invoice Type *</Text>
          <View style={styles.invoiceTypeContainer}>
            <TouchableOpacity
              style={[styles.invoiceTypeOption, { borderColor: colors.border }]}
              onPress={() => setInvoiceType('combined')}
            >
              {invoiceType === 'combined' ? (
                <CheckCircle2 size={20} color={colors.primary} />
              ) : (
                <Circle size={20} color={colors.textSecondary} />
              )}
              <View style={styles.invoiceTypeText}>
                <Text style={[styles.invoiceTypeTitle, { color: colors.text }]}>Combined</Text>
                <Text style={[styles.invoiceTypeDesc, { color: colors.textSecondary }]}>Tiffin + Catering</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.invoiceTypeOption, { borderColor: colors.border }]}
              onPress={() => setInvoiceType('tiffin')}
            >
              {invoiceType === 'tiffin' ? (
                <CheckCircle2 size={20} color={colors.primary} />
              ) : (
                <Circle size={20} color={colors.textSecondary} />
              )}
              <View style={styles.invoiceTypeText}>
                <Text style={[styles.invoiceTypeTitle, { color: colors.text }]}>Tiffin Only</Text>
                <Text style={[styles.invoiceTypeDesc, { color: colors.textSecondary }]}>Tiffin services</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.invoiceTypeOption, { borderColor: colors.border }]}
              onPress={() => setInvoiceType('catering')}
            >
              {invoiceType === 'catering' ? (
                <CheckCircle2 size={20} color={colors.primary} />
              ) : (
                <Circle size={20} color={colors.textSecondary} />
              )}
              <View style={styles.invoiceTypeText}>
                <Text style={[styles.invoiceTypeTitle, { color: colors.text }]}>Catering Only</Text>
                <Text style={[styles.invoiceTypeDesc, { color: colors.textSecondary }]}>Catering services</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dateSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Period</Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.changeDateButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowMonthPicker(true)}
              >
                <CalendarDays size={16} color={colors.surface} />
                <Text style={[styles.changeDateText, { color: colors.surface }]}>Month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.changeDateButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setTempStartDate(startDate);
                  setTempEndDate(endDate);
                  setShowDateModal(true);
                }}
              >
                <Calendar size={16} color={colors.surface} />
                <Text style={[styles.changeDateText, { color: colors.surface }]}>Custom</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={[styles.label, { color: colors.text }]}>Start Date</Text>
              <Text style={[styles.dateDisplay, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}>{formatDisplayDate(startDate)}</Text>
            </View>
            <View style={[styles.field, styles.halfField]}>
              <Text style={[styles.label, { color: colors.text }]}>End Date</Text>
              <Text style={[styles.dateDisplay, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}>{formatDisplayDate(endDate)}</Text>
            </View>
          </View>
        </View>

        {customer && (
          <>
            <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.previewHeader, { borderBottomColor: colors.primary }]}>
                <FileText size={24} color={colors.primary} />
                <Text style={[styles.previewTitle, { color: colors.text }]}>Invoice Preview</Text>
              </View>

              <View style={[styles.customerInfo, { borderBottomColor: colors.border }]}>
                <Text style={[styles.customerName, { color: colors.text }]}>{customer.name}</Text>
                <Text style={[styles.customerDetail, { color: colors.textSecondary }]}>{customer.phone}</Text>
                {customer.address && (
                  <Text style={[styles.customerDetail, { color: colors.textSecondary }]}>{customer.address}</Text>
                )}
              </View>

              <View style={styles.summarySection}>
                {(invoiceType === 'combined' || invoiceType === 'tiffin') && (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Tiffin Entries:</Text>
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{customerTiffins.length}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Tiffin Total:</Text>
                      <Text style={[styles.summaryValue, { color: colors.text }]}>
                        {formatCurrency(tiffinTotal, settings.currency)}
                      </Text>
                    </View>
                  </>
                )}
                {(invoiceType === 'combined' || invoiceType === 'catering') && (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Catering Orders:</Text>
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{customerOrders.length}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Catering Total:</Text>
                      <Text style={[styles.summaryValue, { color: colors.text }]}>
                        {formatCurrency(cateringTotal, settings.currency)}
                      </Text>
                    </View>
                  </>
                )}
                <View style={[styles.summaryRow, styles.grandTotalRow, { borderTopColor: colors.primary }]}>
                  <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Grand Total:</Text>
                  <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
                    {formatCurrency(
                      invoiceType === 'tiffin' ? tiffinTotal : 
                      invoiceType === 'catering' ? cateringTotal : 
                      grandTotal, 
                      settings.currency
                    )}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: colors.primary, opacity: isGenerating ? 0.6 : 1 }]}
              onPress={handleGenerateInvoice}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Download size={20} color={colors.surface} />
                  <Text style={[styles.generateButtonText, { color: colors.surface }]}>Generate PDF Invoice</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
      </ScrollView>

      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerSection}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>Start Date</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={tempStartDate}
                onChangeText={setTempStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                keyboardType="default"
              />

              <Text style={[styles.dateLabel, { color: colors.text, marginTop: spacing.md }]}>End Date</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={tempEndDate}
                onChangeText={setTempEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                keyboardType="default"
              />
            </View>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(tempStartDate) || !dateRegex.test(tempEndDate)) {
                  Alert.alert('Invalid Date', 'Please enter dates in YYYY-MM-DD format');
                  return;
                }
                if (tempStartDate > tempEndDate) {
                  Alert.alert('Invalid Range', 'Start date must be before or equal to end date');
                  return;
                }
                setStartDate(tempStartDate);
                setEndDate(tempEndDate);
                setShowDateModal(false);
              }}
            >
              <Text style={[styles.applyButtonText, { color: colors.surface }]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.yearSelector}>
              <TouchableOpacity
                style={[styles.yearButton, { backgroundColor: colors.background }]}
                onPress={() => setSelectedYear(selectedYear - 1)}
              >
                <Text style={[styles.yearButtonText, { color: colors.text }]}>←</Text>
              </TouchableOpacity>
              <Text style={[styles.yearText, { color: colors.text }]}>{selectedYear}</Text>
              <TouchableOpacity
                style={[styles.yearButton, { backgroundColor: colors.background }]}
                onPress={() => setSelectedYear(selectedYear + 1)}
              >
                <Text style={[styles.yearButtonText, { color: colors.text }]}>→</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {[
                { name: 'January', value: 0 },
                { name: 'February', value: 1 },
                { name: 'March', value: 2 },
                { name: 'April', value: 3 },
                { name: 'May', value: 4 },
                { name: 'June', value: 5 },
                { name: 'July', value: 6 },
                { name: 'August', value: 7 },
                { name: 'September', value: 8 },
                { name: 'October', value: 9 },
                { name: 'November', value: 10 },
                { name: 'December', value: 11 },
              ].map((month) => {
                const isSelected = selectedMonth === month.value && selectedYear === new Date().getFullYear();
                return (
                  <TouchableOpacity
                    key={month.value}
                    style={[
                      styles.monthButton,
                      { backgroundColor: isSelected ? colors.primary : colors.background },
                    ]}
                    onPress={() => {
                      const firstDay = new Date(selectedYear, month.value, 1);
                      const lastDay = new Date(selectedYear, month.value + 1, 0);
                      
                      const formatDate = (date: Date) => {
                        const year = date.getFullYear();
                        const monthStr = String(date.getMonth() + 1).padStart(2, '0');
                        const dayStr = String(date.getDate()).padStart(2, '0');
                        return `${year}-${monthStr}-${dayStr}`;
                      };
                      
                      setStartDate(formatDate(firstDay));
                      setEndDate(formatDate(lastDay));
                      setSelectedMonth(month.value);
                      setShowMonthPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthButtonText,
                        { color: isSelected ? colors.surface : colors.text },
                      ]}
                    >
                      {month.name.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

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
  customerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  customerModalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  customerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  customerSearchList: {
    paddingHorizontal: spacing.lg,
  },
  customerSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  customerSearchItemContent: {
    flex: 1,
    gap: spacing.xs,
  },
  customerSearchItemName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  customerSearchItemPhone: {
    fontSize: fontSize.sm,
  },
  emptySearchState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptySearchText: {
    fontSize: fontSize.md,
  },
  dateSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  changeDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  changeDateText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  dateDisplay: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
  },
  previewCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
  },
  previewTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  customerInfo: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  customerName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  customerDetail: {
    fontSize: fontSize.sm,
    marginBottom: 2,
  },
  summarySection: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSize.md,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  grandTotalRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.md,
  },
  generateButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
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
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
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
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  yearSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearButtonText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  yearText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
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
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  invoiceTypeContainer: {
    gap: spacing.sm,
  },
  invoiceTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  invoiceTypeText: {
    flex: 1,
  },
  invoiceTypeTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  invoiceTypeDesc: {
    fontSize: fontSize.sm,
  },
});
