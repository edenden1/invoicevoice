import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import StatusBadge from './StatusBadge';
import type { Invoice } from '../services/api';

interface InvoiceCardProps {
  invoice: Invoice;
  onPress: () => void;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InvoiceCard({ invoice, onPress }: InvoiceCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.customerName} numberOfLines={1}>
            {invoice.customerName}
          </Text>
          <Text style={styles.invoiceNumber}>#{invoice.invoiceNumber}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.amount}>{formatCurrency(invoice.total)}</Text>
        </View>
      </View>
      <View style={styles.bottomRow}>
        <StatusBadge status={invoice.status} />
        <Text style={styles.date}>{formatDate(invoice.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  left: {
    flex: 1,
    marginRight: spacing.md,
  },
  right: {
    alignItems: 'flex-end',
  },
  customerName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  invoiceNumber: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amount: {
    ...typography.h4,
    color: colors.text,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
