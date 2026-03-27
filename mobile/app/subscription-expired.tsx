import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '../src/components/Button';
import { subscriptionApi, getErrorMessage } from '../src/services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';

export default function SubscriptionExpiredScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const url = await subscriptionApi.getPortalUrl();
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={56} color={colors.primary} />
        </View>

        <Text style={styles.title}>Subscription Ended</Text>
        <Text style={styles.subtitle}>
          Your InvoiceVoice subscription has ended. Renew to keep creating and sending invoices.
        </Text>

        <View style={styles.card}>
          <View style={styles.planRow}>
            <Text style={styles.planName}>Pro Plan</Text>
            <Text style={styles.planPrice}>$29 / month</Text>
          </View>
          <Text style={styles.planFeature}>
            <Ionicons name="checkmark" size={14} color={colors.success} /> Voice-to-invoice in seconds
          </Text>
          <Text style={styles.planFeature}>
            <Ionicons name="checkmark" size={14} color={colors.success} /> PDF invoices with your branding
          </Text>
          <Text style={styles.planFeature}>
            <Ionicons name="checkmark" size={14} color={colors.success} /> SMS and email delivery
          </Text>
          <Text style={styles.planFeature}>
            <Ionicons name="checkmark" size={14} color={colors.success} /> Online payments (optional)
          </Text>
        </View>

        <Button
          title="Renew Subscription"
          onPress={handleManageSubscription}
          loading={isLoading}
          fullWidth
          style={styles.renewButton}
        />

        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="outline"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    marginBottom: spacing.xl,
    ...shadows.small,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  planName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  planPrice: {
    ...typography.h4,
    color: colors.primary,
  },
  planFeature: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  renewButton: {
    marginBottom: spacing.md,
  },
});
