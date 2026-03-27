import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../../src/components/StatusBadge';
import Button from '../../src/components/Button';
import { invoiceApi, getErrorMessage, type Invoice } from '../../src/services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [error, setError] = useState('');

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await invoiceApi.getById(id);
      setInvoice(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleSend = async () => {
    if (!invoice) return;
    Alert.alert(
      'Send Invoice',
      `Send this invoice to ${invoice.customerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setIsSending(true);
            try {
              const updated = await invoiceApi.send(invoice.id);
              setInvoice(updated);
            } catch (err) {
              Alert.alert('Error', getErrorMessage(err));
            } finally {
              setIsSending(false);
            }
          },
        },
      ],
    );
  };

  const handleShare = async () => {
    if (!invoice) return;
    try {
      await Share.share({
        message: `Invoice #${invoice.invoiceNumber}\nCustomer: ${invoice.customerName}\nTotal: ${formatCurrency(invoice.total)}\nStatus: ${invoice.status}`,
        title: `Invoice #${invoice.invoiceNumber}`,
      });
    } catch {
      // user cancelled
    }
  };

  const PAYMENT_METHODS = [
    { label: 'Cash', value: 'cash' },
    { label: 'Check', value: 'check' },
    { label: 'Venmo', value: 'venmo' },
    { label: 'Zelle', value: 'zelle' },
    { label: 'PayPal', value: 'paypal' },
    { label: 'Bank Transfer', value: 'bank_transfer' },
    { label: 'Other', value: 'other' },
  ];

  const handleMarkAsPaid = () => {
    if (!invoice) return;
    Alert.alert(
      'Record Payment',
      'How did you receive payment?',
      [
        ...PAYMENT_METHODS.map((m) => ({
          text: m.label,
          onPress: async () => {
            setIsMarkingPaid(true);
            try {
              const updated = await invoiceApi.markAsPaid(invoice.id, m.value);
              setInvoice(updated);
            } catch (err) {
              Alert.alert('Error', getErrorMessage(err));
            } finally {
              setIsMarkingPaid(false);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDelete = () => {
    if (!invoice) return;
    Alert.alert(
      'Delete Invoice',
      'Are you sure you want to delete this invoice? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await invoiceApi.delete(invoice.id);
              router.back();
            } catch (err) {
              Alert.alert('Error', getErrorMessage(err));
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !invoice) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.gray400} />
        <Text style={styles.errorText}>{error || 'Invoice not found'}</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.invoiceNumber}>Invoice #{invoice.invoiceNumber}</Text>
            <Text style={styles.dateText}>{formatDate(invoice.createdAt)}</Text>
          </View>
          <StatusBadge status={invoice.status} />
        </View>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(invoice.total)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <View style={styles.card}>
          <Text style={styles.customerName}>{invoice.customerName}</Text>
          {invoice.customerPhone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>{invoice.customerPhone}</Text>
            </View>
          ) : null}
          {invoice.serviceAddress ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>{invoice.serviceAddress}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Line Items</Text>
        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.descCol]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.qtyCol]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.priceCol]}>Price</Text>
            <Text style={[styles.tableHeaderText, styles.totalCol]}>Total</Text>
          </View>
          {invoice.lineItems.map((item, index) => (
            <View key={item.id || index} style={styles.tableRow}>
              <View style={styles.descCol}>
                <Text style={styles.itemDesc}>{item.description}</Text>
                <Text style={styles.itemType}>{item.type.replace('_', ' ')}</Text>
              </View>
              <Text style={[styles.tableCell, styles.qtyCol]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.priceCol]}>
                {formatCurrency(item.unitPrice)}
              </Text>
              <Text style={[styles.tableCell, styles.totalCol, styles.boldText]}>
                {formatCurrency(item.total)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Tax ({invoice.taxRate.toFixed(1)}%)
            </Text>
            <Text style={styles.summaryValue}>{formatCurrency(invoice.taxAmount)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalSummaryLabel}>Total</Text>
            <Text style={styles.totalSummaryValue}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>
      </View>

      {invoice.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.card}>
            <Text style={styles.notesText}>{invoice.description}</Text>
          </View>
        </View>
      ) : null}

      {invoice.status === 'PAID' && invoice.paidAt ? (
        <View style={styles.paidBanner}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <View>
            <Text style={styles.paidText}>Paid on {formatDate(invoice.paidAt)}</Text>
            {invoice.paymentMethod ? (
              <Text style={styles.paidMethod}>
                via {invoice.paymentMethod.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {invoice.status === 'DRAFT' ? (
          <>
            <Button
              title="Edit Invoice"
              onPress={() =>
                router.push({ pathname: '/invoice/edit', params: { invoiceId: invoice.id } })
              }
              variant="outline"
              fullWidth
            />
            <Button
              title="Send Invoice"
              onPress={handleSend}
              loading={isSending}
              fullWidth
              style={styles.actionGap}
            />
          </>
        ) : null}

        {invoice.status === 'SENT' || invoice.status === 'VIEWED' || invoice.status === 'OVERDUE' ? (
          <>
            <Button
              title="Resend Invoice"
              onPress={handleSend}
              loading={isSending}
              fullWidth
            />
            <Button
              title="Record Payment"
              onPress={handleMarkAsPaid}
              loading={isMarkingPaid}
              variant="secondary"
              fullWidth
              style={styles.actionGap}
            />
          </>
        ) : null}

        {invoice.status === 'DRAFT' ? (
          <Button
            title="Record Payment"
            onPress={handleMarkAsPaid}
            loading={isMarkingPaid}
            variant="secondary"
            fullWidth
            style={styles.actionGap}
          />
        ) : null}

        <Button
          title="Share"
          onPress={handleShare}
          variant="outline"
          fullWidth
          style={styles.actionGap}
        />

        {invoice.status === 'DRAFT' ? (
          <Button
            title="Delete Invoice"
            onPress={handleDelete}
            variant="danger"
            fullWidth
            style={styles.actionGap}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
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
  headerCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  invoiceNumber: {
    ...typography.bodyBold,
    color: colors.white,
  },
  dateText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  totalLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
  totalValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 44,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.small,
  },
  customerName: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    marginBottom: spacing.sm,
  },
  tableHeaderText: {
    ...typography.smallBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  descCol: {
    flex: 3,
  },
  qtyCol: {
    flex: 1,
    textAlign: 'center',
  },
  priceCol: {
    flex: 1.5,
    textAlign: 'right',
  },
  totalCol: {
    flex: 1.5,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  tableCell: {
    ...typography.caption,
    color: colors.text,
  },
  itemDesc: {
    ...typography.caption,
    color: colors.text,
  },
  itemType: {
    ...typography.small,
    color: colors.textLight,
    textTransform: 'capitalize',
  },
  boldText: {
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.caption,
    color: colors.text,
  },
  totalRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  totalSummaryLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  totalSummaryValue: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  notesText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  paidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  paidText: {
    ...typography.bodyBold,
    color: colors.success,
  },
  paidMethod: {
    ...typography.small,
    color: colors.success,
    opacity: 0.8,
    marginTop: 2,
  },
  actions: {
    marginTop: spacing.sm,
  },
  actionGap: {
    marginTop: spacing.md,
  },
});
