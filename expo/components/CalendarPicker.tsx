import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';

interface CalendarPickerProps {
  visible: boolean;
  date: Date;
  onDateChange: (date: Date) => void;
  onConfirm: () => void;
  onCancel: () => void;
  colors: any;
}

export default function CalendarPicker({
  visible,
  date,
  onDateChange,
  onConfirm,
  onCancel,
  colors,
}: CalendarPickerProps) {
  const [dateText, setDateText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setDateText(`${year}-${month}-${day}`);
      setError('');
    }
  }, [visible, date]);

  const validateAndSetDate = (text: string) => {
    setDateText(text);
    setError('');

    if (text.length === 10) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(text)) {
        setError('Invalid format. Use YYYY-MM-DD');
        return;
      }

      const [year, month, day] = text.split('-').map(Number);
      
      if (year < 1900 || year > 2100) {
        setError('Year must be between 1900 and 2100');
        return;
      }

      if (month < 1 || month > 12) {
        setError('Month must be between 01 and 12');
        return;
      }

      const daysInMonth = new Date(year, month, 0).getDate();
      if (day < 1 || day > daysInMonth) {
        setError(`Day must be between 01 and ${daysInMonth}`);
        return;
      }

      const newDate = new Date(year, month - 1, day);
      onDateChange(newDate);
    }
  };

  const handleConfirm = () => {
    if (error || dateText.length !== 10) {
      setError('Please enter a valid date');
      return;
    }
    onConfirm();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>Select Date</Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Enter date (YYYY-MM-DD)
            </Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: error ? '#ef4444' : colors.border,
                }
              ]}
              value={dateText}
              onChangeText={validateAndSetDate}
              placeholder="2025-10-03"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              autoFocus
            />
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Example: 2025-10-03
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={onCancel}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={[styles.buttonText, { color: colors.surface }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
  },
  errorText: {
    color: '#ef4444',
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
