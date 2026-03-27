import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { profileApi } from '../src/services/api';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, typography } from '../src/theme';

// This screen is opened automatically when Stripe redirects back to the app
// via the deep link: invoicevoice://stripe-callback
// It confirms onboarding status with the server then returns to Settings.
export default function StripeCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const isRefresh = params.refresh === '1'; // invoicevoice://stripe-refresh

  useEffect(() => {
    async function confirm() {
      try {
        await profileApi.confirmStripeOnboarding();
        await refreshUser();
        setStatus('success');
        setTimeout(() => router.replace('/settings'), 1500);
      } catch {
        setStatus('error');
        setTimeout(() => router.replace('/settings'), 2000);
      }
    }
    confirm();
  }, [refreshUser, router]);

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>
            {isRefresh ? 'Refreshing setup...' : 'Confirming your payment setup...'}
          </Text>
        </>
      )}
      {status === 'success' && (
        <>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.title}>Payment Setup Complete</Text>
          <Text style={styles.message}>Your customers can now pay online. Returning to settings...</Text>
        </>
      )}
      {status === 'error' && (
        <>
          <Ionicons name="time-outline" size={64} color={colors.accent} />
          <Text style={styles.title}>Still Processing</Text>
          <Text style={styles.message}>
            Stripe is still verifying your account. Check back in a few minutes. Returning to settings...
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxxl,
    gap: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
