import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Input from '../../src/components/Input';
import Button from '../../src/components/Button';
import LineItemRow, { type LineItemData } from '../../src/components/LineItemRow';
import { invoiceApi, getErrorMessage } from '../../src/services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';

function computeTotals(items: LineItemData[], taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export default function InvoiceEditScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [description, setDescription] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [lineItems, setLineItems] = useState<LineItemData[]>([]);

  const fetchInvoice = useCallback(async () => {
    if (!invoiceId) {
      setIsLoading(false);
      setError('No invoice ID provided.');
      return;
    }
    try {
      const invoice = await invoiceApi.getById(invoiceId);
      setCustomerName(invoice.customerName || '');
      setCustomerPhone(invoice.customerPhone || '');
      setServiceAddress(invoice.serviceAddress || '');
      setDescription(invoice.description || '');
      setTaxRate(invoice.taxRate || 0);
      setLineItems(
        invoice.lineItems.map((item) => ({
          type: item.type,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleLineItemChange = (index: number, field: keyof LineItemData, value: string) => {
    setLineItems((prev) => {
      const updated = [...prev];
      if (field === 'quantity' || field === 'unitPrice') {
        const num = parseFloat(value) || 0;
        updated[index] = { ...updated[index], [field]: num };
      } else if (field === 'type') {
        updated[index] = { ...updated[index], type: value as LineItemData['type'] };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleDeleteLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { type: 'LABOR', description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const buildPayload = () => ({
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim() || undefined,
    serviceAddress: serviceAddress.trim() || undefined,
    description: description.trim() || undefined,
    taxRate,
    lineItems: lineItems.map((item) => ({
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    })),
  });

  const isBusy = isSaving || isSending;

  const handleSave = async () => {
    if (!customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter a customer name.');
      return;
    }
    if (lineItems.length === 0) {
      Alert.alert('Missing Info', 'Please add at least one line item.');
      return;
    }
    if (isBusy) return;
    if (!invoiceId) return;
    setIsSaving(true);
    try {
      await invoiceApi.update(invoiceId, buildPayload());
      router.back();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    if (!customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter a customer name.');
      return;
    }
    if (lineItems.length === 0) {
      Alert.alert('Missing Info', 'Please add at least one line item.');
      return;
    }
    if (isBusy) return;
    if (!invoiceId) return;
    setIsSending(true);
    try {
      await invoiceApi.update(invoiceId, buildPayload());
      await invoiceApi.send(invoiceId);
      router.replace('/(tabs)/invoices');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const { subtotal, taxAmount, total } = computeTotals(lineItems, taxRate);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Info</Text>
          <Input
            label="Customer Name"
            placeholder="John Smith"
            value={customerName}
            onChangeText={setCustomerName}
          />
          <Input
            label="Phone"
            placeholder="(555) 123-4567"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
          />
          <Input
            label="Service Address"
            placeholder="123 Main St, City, ST"
            value={serviceAddress}
            onChangeText={setServiceAddress}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            <Button
              title="+ Add Item"
              onPress={handleAddLineItem}
              variant="outline"
              style={styles.addButton}
              textStyle={styles.addButtonText}
            />
          </View>
          {lineItems.map((item, index) => (
            <LineItemRow
              key={index}
              item={item}
              index={index}
              onChange={handleLineItemChange}
              onDelete={handleDeleteLineItem}
            />
          ))}
          {lineItems.length === 0 ? (
            <Text style={styles.noItems}>No line items. Tap "+ Add Item" to add one.</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Rate (%)</Text>
          <Input
            placeholder="0"
            value={taxRate > 0 ? String(taxRate) : ''}
            onChangeText={(text) => {
              const val = parseFloat(text) || 0;
              setTaxRate(Math.min(val, 100));
            }}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>${taxAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Input
            label="Description (optional)"
            placeholder="Any additional notes..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.buttonGroup}>
          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={isSaving}
            variant="outline"
            fullWidth
          />
          <Button
            title="Save & Send"
            onPress={handleSaveAndSend}
            loading={isSending}
            fullWidth
            style={styles.buttonGap}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.base,
    backgroundColor: colors.background,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    minWidth: 80,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    fontSize: 13,
  },
  noItems: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  totalsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.caption,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: spacing.sm,
  },
  grandTotalLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  grandTotalValue: {
    ...typography.h3,
    color: colors.primary,
  },
  buttonGroup: {
    marginTop: spacing.sm,
  },
  buttonGap: {
    marginTop: spacing.md,
  },
});
