import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Alert, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import * as Contacts from 'expo-contacts';
import { UserPlus, Users } from 'lucide-react-native';
import { useCustomers } from '@/contexts/CustomerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/constants/theme';

export default function AddCustomerScreen() {
  const insets = useSafeAreaInsets();
  const { addCustomer } = useCustomers();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<'Regular' | 'Occasional'>('Regular');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<{ name: string; phone: string; address: string }[]>([]);

  const handleImportFromContacts = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Contact import is not available on web. Please enter customer details manually.');
      return;
    }

    console.log('Starting contact import...');
    setContacts([]);
    
    let Contacts: any;
    try {
      const contactsModule = await import('expo-contacts');
      if (!contactsModule || !contactsModule.getContactsAsync) {
        throw new Error('Contacts module not available');
      }
      Contacts = contactsModule;
    } catch (moduleError) {
      console.error('Contact module load error:', moduleError);
      Alert.alert(
        'Feature Unavailable',
        'Contact import is not available on this device. Please enter customer details manually.'
      );
      return;
    }

    try {
      console.log('Checking current permission status...');
      const { status: currentStatus } = await Contacts.getPermissionsAsync();
      console.log('Permission check successful:', currentStatus);
      console.log('Current permission status:', currentStatus);

      let finalStatus = currentStatus;

      if (currentStatus !== 'granted') {
        console.log('Requesting contacts permission...');
        const { status: newStatus } = await Contacts.requestPermissionsAsync();
        console.log('Permission request result:', newStatus);
        finalStatus = newStatus;
      }

      if (finalStatus !== 'granted') {
        console.log('Permission denied by user');
        Alert.alert(
          'Permission Required',
          'Please enable contacts permission in your device settings to import contacts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => console.log('User should open settings') }
          ]
        );
        return;
      }

      console.log('Permission granted, fetching contacts...');
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Addresses,
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      console.log(`Fetched ${data.length} contacts from device`);
      console.log('First 3 contacts:', JSON.stringify(data.slice(0, 3), null, 2));

      if (data.length === 0) {
        Alert.alert('No Contacts', 'No contacts found on your device.');
        return;
      }

      const contactOptions = data
        .map((contact: any, index: number) => {
          try {
            const fullName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
            
            let phoneNumber = '';
            if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
              const firstPhone = contact.phoneNumbers[0];
              
              if (typeof firstPhone === 'string') {
                phoneNumber = firstPhone;
              } else if (typeof firstPhone === 'object' && firstPhone !== null) {
                phoneNumber = (firstPhone as any).number || 
                             (firstPhone as any).digits || 
                             (firstPhone as any).stringValue || '';
              }
            }
            
            phoneNumber = phoneNumber.replace(/[^0-9+\-\s()]/g, '').trim();
            
            const addressParts = [];
            if (contact.addresses && contact.addresses.length > 0) {
              const addr = contact.addresses[0];
              if (addr.street) addressParts.push(addr.street);
              if (addr.city) addressParts.push(addr.city);
              if (addr.postalCode) addressParts.push(addr.postalCode);
            }
            
            if (index < 5) {
              console.log(`Contact ${index}: name="${fullName}", phone="${phoneNumber}"`);
            }
            
            return {
              name: fullName || 'Unknown',
              phone: phoneNumber,
              address: addressParts.join(', '),
              hasValidPhone: phoneNumber.length >= 3,
              rawContact: contact,
            };
          } catch (err) {
            console.error('Error processing contact:', err);
            return {
              name: 'Unknown',
              phone: '',
              address: '',
              hasValidPhone: false,
              rawContact: contact,
            };
          }
        })
        .filter((contact: any) => contact.hasValidPhone && contact.name !== 'Unknown')
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      console.log(`Filtered to ${contactOptions.length} valid contacts`);
      console.log('First 5 filtered contacts:', JSON.stringify(contactOptions.slice(0, 5), null, 2));

      if (contactOptions.length === 0) {
        console.log('No valid contacts after filtering');
        console.log('Total contacts fetched:', data.length);
        
        if (data.length > 0) {
          console.log('First contact sample:', JSON.stringify(data[0], null, 2));
        }
        
        if (data.length === 0) {
          Alert.alert(
            'No Contacts',
            'No contacts found on your device. Please add contacts to your device first or enter customer details manually.'
          );
        } else {
          Alert.alert(
            'No Valid Contacts', 
            `Found ${data.length} contact(s) but couldn't extract phone numbers. You can add the customer manually by entering the details below.`
          );
        }
        return;
      }

      const cleanContacts = contactOptions.map(({ hasValidPhone, rawContact, ...rest }: any) => rest);
      setContacts(cleanContacts);
      setShowContactPicker(true);
      console.log('Contact picker opened successfully');
    } catch (error) {
      console.error('Failed to import contacts:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      let errorMessage = 'An unexpected error occurred';
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please enable contacts access in your device settings';
        } else if (error.message.includes('not available') || error.message.includes('undefined')) {
          errorMessage = 'Contact import is not available on this device';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        'Import Failed',
        `${errorMessage}. You can enter customer details manually instead.`
      );
    }
  };

  const handleSelectContact = (contact: { name: string; phone: string; address: string }) => {
    console.log('Selected contact:', contact);
    setName(contact.name);
    setPhone(contact.phone);
    setAddress(contact.address);
    setShowContactPicker(false);
    setContacts([]);
  };

  const handleCloseContactPicker = () => {
    console.log('Closing contact picker');
    setShowContactPicker(false);
    setContacts([]);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill in name and phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      await addCustomer({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
        type,
        active: true,
      });
      Alert.alert('Success', 'Customer added successfully');
      router.back();
    } catch (error) {
      console.error('Failed to add customer:', error);
      Alert.alert('Error', 'Failed to add customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Add Customer',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />

      <Modal
        visible={showContactPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseContactPicker}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
            <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Contact</Text>
              <TouchableOpacity onPress={handleCloseContactPicker} style={styles.modalCloseButton}>
                <Text style={[styles.modalCloseText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          <FlatList
            data={contacts}
            keyExtractor={(item, index) => `${item.phone}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.contactItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
                onPress={() => handleSelectContact(item)}
              >
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.contactPhone, { color: colors.textSecondary }]}>{item.phone}</Text>
                  {item.address ? (
                    <Text style={[styles.contactAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.contactListContent}
          />
        </View>
      </Modal>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={[styles.importButton, { backgroundColor: colors.secondary }]}
            onPress={handleImportFromContacts}
          >
            <Users size={20} color={colors.surface} />
            <Text style={[styles.importButtonText, { color: colors.surface }]}>Import from Contacts</Text>
          </TouchableOpacity>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={name}
            onChangeText={setName}
            placeholder="Enter customer name"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Phone *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="+31 6 12345678"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter address (optional)"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Customer Type</Text>
          <View style={styles.typeButtons}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                type === 'Regular' && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => setType('Regular')}
            >
              <Text style={[
                styles.typeButtonText,
                { color: colors.textSecondary },
                type === 'Regular' && { color: colors.surface }
              ]}>
                Regular
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                type === 'Occasional' && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => setType('Occasional')}
            >
              <Text style={[
                styles.typeButtonText,
                { color: colors.textSecondary },
                type === 'Occasional' && { color: colors.surface }
              ]}>
                Occasional
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <UserPlus size={20} color={colors.surface} />
          <Text style={[styles.submitButtonText, { color: colors.surface }]}>
            {isSubmitting ? 'Adding...' : 'Add Customer'}
          </Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
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
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  importButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    ...shadows.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  modalContainer: {
    flex: 1,
  },
  modalSafeArea: {
    backgroundColor: 'transparent',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  contactListContent: {
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalCloseText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  contactItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  contactInfo: {
    gap: spacing.xs,
  },
  contactName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  contactPhone: {
    fontSize: fontSize.sm,
  },
  contactAddress: {
    fontSize: fontSize.sm,
  },
});
