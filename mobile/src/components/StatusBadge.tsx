import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme';
import type { InvoiceStatus } from '../services/api';

interface StatusBadgeProps {
  status: InvoiceStatus;
}

const statusConfig: Record<InvoiceStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: colors.gray200, text: colors.gray700, label: 'Draft' },
  SENT: { bg: '#E8EEF4', text: colors.primary, label: 'Sent' },
  VIEWED: { bg: '#F0EBFF', text: colors.statusViewed, label: 'Viewed' },
  PAID: { bg: colors.successLight, text: colors.success, label: 'Paid' },
  OVERDUE: { bg: colors.dangerLight, text: colors.danger, label: 'Overdue' },
  CANCELLED: { bg: colors.gray200, text: colors.gray600, label: 'Cancelled' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.DRAFT;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.smallBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
