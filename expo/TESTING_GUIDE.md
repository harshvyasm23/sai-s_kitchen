# Sai's Kitchen - Testing Guide

## Overview
This guide helps you test all features of the Tiffin Tracker & Invoice Generator app.

---

## Test Scenarios

### 1. Customer Management

#### Test 1.1: Add Customer Manually
**Steps:**
1. Navigate to Customers tab
2. Tap the "+" button
3. Fill in:
   - Name: "John Doe"
   - Phone: "+31 6 12345678"
   - Address: "Amsterdam, Netherlands"
   - Type: "Regular"
4. Tap "Add Customer"

**Expected Result:**
- Success alert appears
- Customer appears in the list
- Customer card shows name, phone, address, and type badge

#### Test 1.2: Import from Phone Contacts (Mobile Only)
**Steps:**
1. Navigate to Customers tab
2. Tap "+" button
3. Tap "Import from Contacts"
4. Grant permission if requested
5. First contact is auto-filled
6. Edit if needed and save

**Expected Result:**
- Contact data is imported
- Fields are populated
- Can save successfully

#### Test 1.3: Search Customers
**Steps:**
1. Add multiple customers
2. Use search bar
3. Search by name: "John"
4. Search by phone: "123"

**Expected Result:**
- Results filter in real-time
- Both name and phone searches work

---

### 2. Tiffin Entry

#### Test 2.1: Add Basic Tiffin Entry
**Steps:**
1. Navigate to Entries tab
2. Tap "Tiffin Entry"
3. Select customer from dropdown
4. Enter:
   - Date: Today's date (auto-filled)
   - Noon Qty: 2
   - Evening Qty: 3
   - Unit Price: 20 (default)
   - Delivery: 2 (default)
5. Tap "Add Tiffin Entry"

**Expected Result:**
- Total shows: €102 (5 × 20 + 2)
- Success alert appears
- Returns to Entries screen

#### Test 2.2: Decimal Calculation Test
**Steps:**
1. Add tiffin entry with:
   - Noon Qty: 4.5
   - Evening Qty: 0
   - Unit Price: 20
   - Delivery: 0

**Expected Result:**
- Total shows: €90.00 (4.5 × 20)
- Calculation is accurate

#### Test 2.3: Validation Test
**Steps:**
1. Try to submit without selecting customer
2. Try to submit with 0 quantities

**Expected Result:**
- Error alerts appear
- Form doesn't submit

---

### 3. Catering Entry

#### Test 3.1: Add Catering Order with Multiple Items
**Steps:**
1. Navigate to Entries tab
2. Tap "Catering Order"
3. Select customer
4. Add Item 1:
   - Name: "Biryani"
   - Qty: 10
   - Unit Price: 15
5. Tap "Add Item"
6. Add Item 2:
   - Name: "Samosas"
   - Qty: 20
   - Unit Price: 2
7. Delivery Charge: 5
8. Tap "Add Catering Order"

**Expected Result:**
- Item 1 total: €150
- Item 2 total: €40
- Items Total: €190
- Grand Total: €195 (190 + 5)
- Success alert appears

#### Test 3.2: Decimal Calculation in Catering
**Steps:**
1. Add catering item:
   - Qty: 2.5
   - Unit Price: 12.50

**Expected Result:**
- Item total shows: €31.25 (2.5 × 12.50)

#### Test 3.3: Remove Item
**Steps:**
1. Add multiple items
2. Tap trash icon on one item

**Expected Result:**
- Item is removed
- Totals recalculate
- Cannot remove last item

---

### 4. Invoice Generation

#### Test 4.1: Generate Invoice with Tiffin Only
**Steps:**
1. Add customer "Jane Smith"
2. Add 2 tiffin entries for Jane
3. Navigate to Invoices tab
4. Tap "Generate Invoice"
5. Select "Jane Smith"
6. Review preview
7. Tap "Generate PDF Invoice"

**Expected Result:**
- Preview shows:
  - Customer details
  - Tiffin entries count
  - Tiffin total
  - Catering: 0
  - Grand total
- Alert shows invoice summary

#### Test 4.2: Generate Invoice with Mixed Entries
**Steps:**
1. Add customer "Bob Wilson"
2. Add 1 tiffin entry
3. Add 1 catering order
4. Generate invoice for Bob

**Expected Result:**
- Preview shows both tiffin and catering
- Totals are accurate
- All data is displayed correctly

#### Test 4.3: No Data Validation
**Steps:**
1. Try to generate invoice without selecting customer
2. Select customer with no entries

**Expected Result:**
- Appropriate error alerts appear
- Cannot proceed without data

---

### 5. Theme Support

#### Test 5.1: Toggle Theme
**Steps:**
1. Navigate to Settings tab
2. Tap theme toggle button
3. Switch between light and dark

**Expected Result:**
- All screens update immediately
- Colors are consistent
- Text is readable in both themes
- Forms maintain proper contrast

#### Test 5.2: Theme Persistence
**Steps:**
1. Set theme to dark
2. Close and reopen app

**Expected Result:**
- Dark theme is maintained
- Setting is persisted

---

### 6. Settings

#### Test 6.1: Update Default Prices
**Steps:**
1. Navigate to Settings
2. Change default tiffin price to 25
3. Change default delivery to 3
4. Save settings
5. Create new tiffin entry

**Expected Result:**
- New defaults are used
- Old entries unchanged

---

### 7. Data Persistence

#### Test 7.1: Data Survives App Restart
**Steps:**
1. Add customers, tiffin entries, catering orders
2. Close app completely
3. Reopen app

**Expected Result:**
- All data is still present
- Nothing is lost

---

### 8. Edge Cases

#### Test 8.1: Large Numbers
**Steps:**
1. Enter tiffin with qty: 100
2. Enter catering with qty: 500

**Expected Result:**
- Calculations are accurate
- No overflow errors
- Display is readable

#### Test 8.2: Special Characters
**Steps:**
1. Add customer with name: "O'Brien & Sons"
2. Add notes with special chars

**Expected Result:**
- Data saves correctly
- Display is correct

#### Test 8.3: Empty Optional Fields
**Steps:**
1. Add customer without address
2. Add tiffin without notes
3. Add catering without notes

**Expected Result:**
- All save successfully
- No errors

---

## Decimal Calculation Verification

### Test Cases:
1. **4.5 × 20 = 90** ✓
2. **1.5 × 8 + 2 = 14** ✓
3. **2.5 × 12.50 = 31.25** ✓
4. **10.75 × 3.5 = 37.625 → €37.63** ✓

---

## Known Limitations

1. **Web Platform:**
   - Contact import not available
   - Use manual entry instead

2. **PDF Generation:**
   - Currently shows alert with summary
   - Full PDF export coming in next version

3. **Date Picker:**
   - Manual entry (YYYY-MM-DD format)
   - Date picker widget coming soon

---

## Reporting Issues

If you find any bugs:
1. Note the exact steps to reproduce
2. Check console logs for errors
3. Verify data in AsyncStorage
4. Test in both light and dark themes

---

## Success Criteria

✅ All customer operations work
✅ Tiffin entries save with decimal support
✅ Catering orders handle multiple items
✅ Invoice generation shows correct totals
✅ Theme switching works everywhere
✅ Data persists across app restarts
✅ Contact import works on mobile
✅ All calculations are accurate to 2 decimals
