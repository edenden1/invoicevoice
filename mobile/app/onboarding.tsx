import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../src/components/Button';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';

// Shown once after registration. Explains the app and the two separate
// payment concepts so clients aren't confused:
//   1. Their InvoiceVoice subscription ($29/mo) — billed separately
//   2. Accepting payments from their customers — optional PayMe onboarding

interface Step {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  description: string;
  badge?: string;
}

const STEPS: Step[] = [
  {
    icon: 'mic',
    color: colors.primary,
    title: 'Record an invoice by voice',
    description:
      'After finishing a job, tap Record and describe what you did. Our AI creates a professional invoice in seconds.',
  },
  {
    icon: 'send',
    color: colors.accent,
    title: 'Send it to your customer',
    description:
      'The invoice goes to your customer by text message with a link they can open on their phone.',
  },
  {
    icon: 'cash',
    color: colors.success,
    title: 'Get paid — your way',
    description:
      'Customers can pay online (Apple Pay, Google Pay, card, bank transfer) or you can collect cash, Venmo, Zelle, or a check and mark it paid manually. Online payments are optional.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.profile?.ownerName?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.welcome}>Welcome, {firstName}!</Text>
          <Text style={styles.subtitle}>
            Here's how InvoiceVoice works. It takes about 60 seconds to send your first invoice.
          </Text>
        </View>

        <View style={styles.steps}>
          {STEPS.map((step, index) => (
            <View key={index} style={styles.stepCard}>
              <View style={[styles.stepIcon, { backgroundColor: step.color + '18' }]}>
                <Ionicons name={step.icon} size={28} color={step.color} />
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                  <Text style={styles.stepNumber}>Step {index + 1}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.clarificationBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <View style={styles.clarificationText}>
            <Text style={styles.clarificationTitle}>Two separate payment things</Text>
            <Text style={styles.clarificationBody}>
              {'1. '}
              <Text style={styles.bold}>Your InvoiceVoice subscription</Text>
              {' ($29/mo) — that\'s you paying us to use the app.\n'}
              {'2. '}
              <Text style={styles.bold}>Accepting payments from your customers</Text>
              {' — that\'s optional. Set it up later in Settings under "Accept Customer Payments".'}
            </Text>
          </View>
        </View>

        <Button
          title="Start Recording Invoices"
          onPress={() => router.replace('/(tabs)')}
          fullWidth
          style={styles.cta}
        />

        <TouchableOpacity
          onPress={() => router.replace('/settings')}
          activeOpacity={0.7}
          style={styles.settingsLink}
        >
          <Text style={styles.settingsLinkText}>Complete my business profile first</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  welcome: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  steps: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  stepCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.small,
  },
  stepIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  stepNumber: {
    ...typography.small,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  clarificationBox: {
    backgroundColor: colors.primary + '0D',
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  clarificationText: {
    flex: 1,
  },
  clarificationTitle: {
    ...typography.captionBold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  clarificationBody: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
    color: colors.text,
  },
  cta: {
    marginBottom: spacing.md,
  },
  settingsLink: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  settingsLinkText: {
    ...typography.captionBold,
    color: colors.primary,
  },
});
