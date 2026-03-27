import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import InvoiceCard from '../../src/components/InvoiceCard';
import Button from '../../src/components/Button';
import { useInvoices } from '../../src/hooks/useInvoices';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import type { InvoiceStatus } from '../../src/services/api';

const FILTER_TABS: Array<{ label: string; value: InvoiceStatus | null }> = [
  { label: 'All', value: null },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Paid', value: 'PAID' },
];

export default function InvoicesScreen() {
  const router = useRouter();
  const { invoices, isLoading, isRefreshing, error, refresh, filterByStatus, activeFilter } =
    useInvoices();

  const renderHeader = () => (
    <View>
      <Text style={styles.title}>Invoices</Text>
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.label}
            onPress={() => filterByStatus(tab.value)}
            style={[
              styles.filterTab,
              activeFilter === tab.value && styles.filterTabActive,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab.value && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="mic-outline" size={56} color={colors.gray400} />
        <Text style={styles.emptyTitle}>
          {activeFilter ? `No ${activeFilter} invoices` : 'No invoices yet'}
        </Text>
        <Text style={styles.emptySubtext}>
          {activeFilter
            ? 'Try a different filter or create a new invoice.'
            : "Tap the mic to create your first one!"}
        </Text>
        {!activeFilter ? (
          <Button
            title="Record Invoice"
            onPress={() => router.push('/(tabs)/record')}
            variant="secondary"
            style={styles.emptyButton}
          />
        ) : null}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !invoices.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.gray400} />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try Again" onPress={refresh} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InvoiceCard
            invoice={item}
            onPress={() => router.push(`/invoice/${item.id}`)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.base,
  },
  listContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.base,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    minHeight: 44,
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    ...typography.captionBold,
    color: colors.gray600,
  },
  filterTabTextActive: {
    color: colors.white,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyButton: {
    marginTop: spacing.base,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
