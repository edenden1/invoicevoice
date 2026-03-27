import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme';

export interface LineItemData {
  type: 'LABOR' | 'MATERIAL' | 'FLAT_RATE' | 'OTHER';
  description: string;
  quantity: number;
  unitPrice: number;
}

interface LineItemRowProps {
  item: LineItemData;
  index: number;
  onChange: (index: number, field: keyof LineItemData, value: string) => void;
  onDelete: (index: number) => void;
}

const typeLabels: Record<string, string> = {
  LABOR: 'Labor',
  MATERIAL: 'Material',
  FLAT_RATE: 'Flat Rate',
  OTHER: 'Other',
};

const typeOptions: Array<LineItemData['type']> = ['LABOR', 'MATERIAL', 'FLAT_RATE', 'OTHER'];

export default function LineItemRow({ item, index, onChange, onDelete }: LineItemRowProps) {
  const total = item.quantity * item.unitPrice;

  const cycleType = () => {
    const currentIdx = typeOptions.indexOf(item.type);
    const nextIdx = (currentIdx + 1) % typeOptions.length;
    onChange(index, 'type', typeOptions[nextIdx]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={cycleType} style={styles.typeButton} activeOpacity={0.7}>
          <Text style={styles.typeText}>{typeLabels[item.type]}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(index)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.descriptionInput}
        placeholder="Description"
        placeholderTextColor={colors.textLight}
        value={item.description}
        onChangeText={(text) => onChange(index, 'description', text)}
      />

      <View style={styles.numbersRow}>
        <View style={styles.numberField}>
          <Text style={styles.fieldLabel}>Qty</Text>
          <TextInput
            style={styles.numberInput}
            keyboardType="decimal-pad"
            value={item.quantity > 0 ? String(item.quantity) : ''}
            placeholder="0"
            placeholderTextColor={colors.textLight}
            onChangeText={(text) => onChange(index, 'quantity', text)}
          />
        </View>
        <View style={styles.separator}>
          <Ionicons name="close" size={16} color={colors.textLight} />
        </View>
        <View style={styles.numberField}>
          <Text style={styles.fieldLabel}>Unit Price</Text>
          <View style={styles.priceInputWrapper}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.numberInput}
              keyboardType="decimal-pad"
              value={item.unitPrice > 0 ? String(item.unitPrice) : ''}
              placeholder="0.00"
              placeholderTextColor={colors.textLight}
              onChangeText={(text) => onChange(index, 'unitPrice', text)}
            />
          </View>
        </View>
        <View style={styles.totalContainer}>
          <Text style={styles.fieldLabel}>Total</Text>
          <Text style={styles.totalText}>${total.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 4,
  },
  typeText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  descriptionInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  numbersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  numberField: {
    flex: 1,
  },
  fieldLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  numberInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    minHeight: 44,
    textAlign: 'center',
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    minHeight: 44,
  },
  dollarSign: {
    ...typography.body,
    color: colors.textSecondary,
    paddingLeft: spacing.sm,
  },
  separator: {
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
  },
  totalContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  totalText: {
    ...typography.bodyBold,
    color: colors.text,
    paddingVertical: spacing.sm,
    minHeight: 44,
    textAlignVertical: 'center',
  },
});
