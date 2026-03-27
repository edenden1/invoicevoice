import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useDashboard } from '../../src/hooks/useDashboard';
import { useInvoices } from '../../src/hooks/useInvoices';
import StatCard from '../../src/components/StatCard';
import InvoiceCard from '../../src/components/InvoiceCard';
import Button from '../../src/components/Button';
import { colors, spacing, typography, shadows, borderRadius } from '../../src/theme';

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(0)}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { stats, isLoading, isRefreshing, error, refresh } = useDashboard();
  const { invoices: recentInvoices } = useInvoices();

  const ownerName = user?.profile?.ownerName?.split(' ')[0] || 'there';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !stats) {
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hey, {ownerName}!</Text>
            <Text style={styles.subGreeting}>Here's your business today</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        {!user?.profile?.stripeOnboarded && !user?.profile?.addressLine1 ? (
          <TouchableOpacity
            style={styles.setupCard}
            onPress={() => router.push('/settings')}
            activeOpacity={0.8}
          >
            <View style={styles.setupCardLeft}>
              <Ionicons name="rocket-outline" size={22} color={colors.white} />
              <View>
                <Text style={styles.setupCardTitle}>Finish setting up</Text>
                <Text style={styles.setupCardSub}>Add your address & payment options</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        ) : !user?.profile?.stripeOnboarded ? (
          <TouchableOpacity
            style={[styles.setupCard, styles.setupCardAccent]}
            onPress={() => router.push('/settings')}
            activeOpacity={0.8}
          >
            <View style={styles.setupCardLeft}>
              <Ionicons name="card-outline" size={22} color={colors.white} />
              <View>
                <Text style={styles.setupCardTitle}>Enable online payments</Text>
                <Text style={styles.setupCardSub}>Let customers pay by Apple Pay, Google Pay & more</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard
            title="Revenue"
            value={formatCurrency(stats?.totalRevenue ?? 0)}
            subtitle="All time"
            icon="cash-outline"
            color={colors.success}
          />
          <View style={styles.statGap} />
          <StatCard
            title="Unpaid"
            value={formatCurrency(stats?.unpaidAmount ?? 0)}
            subtitle="Outstanding"
            icon="alert-circle-outline"
            color={colors.accent}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title="Total"
            value={String(stats?.invoiceCount ?? 0)}
            subtitle="Invoices"
            icon="document-text-outline"
            color={colors.primary}
          />
          <View style={styles.statGap} />
          <StatCard
            title="Paid"
            value={String(stats?.paidCount ?? 0)}
            subtitle="Invoices"
            icon="checkmark-circle-outline"
            color={colors.success}
          />
        </View>

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Invoices</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/invoices')} activeOpacity={0.7}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentInvoices.length > 0 ? (
            recentInvoices.slice(0, 5).map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: invoice.id } })}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="mic-outline" size={40} color={colors.gray400} />
              <Text style={styles.emptyText}>Ready to invoice?</Text>
              <Text style={styles.emptySubtext}>Tap "Record New Invoice" below to get started!</Text>
            </View>
          )}
        </View>

        <Button
          title="Record New Invoice"
          onPress={() => router.push('/(tabs)/record')}
          variant="secondary"
          fullWidth
          style={styles.ctaButton}
        />
      </ScrollView>
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
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.h2,
    color: colors.text,
  },
  subGreeting: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  setupCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  setupCardAccent: {
    backgroundColor: colors.accent,
  },
  setupCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  setupCardTitle: {
    ...typography.bodyBold,
    color: colors.white,
  },
  setupCardSub: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  statGap: {
    width: spacing.md,
  },
  flex: {
    flex: 1,
  },
  recentSection: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
  },
  seeAll: {
    ...typography.captionBold,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  emptyText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: spacing.xl,
  },
});
