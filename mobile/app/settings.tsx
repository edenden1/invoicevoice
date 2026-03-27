import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Input from '../src/components/Input';
import Button from '../src/components/Button';
import { useAuth } from '../src/contexts/AuthContext';
import { profileApi, subscriptionApi, getErrorMessage, type SubscriptionInfo } from '../src/services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';

const TRADE_TYPES: Array<{ label: string; value: string }> = [
  { label: 'Plumbing', value: 'PLUMBING' },
  { label: 'Electrical', value: 'ELECTRICAL' },
  { label: 'HVAC', value: 'HVAC' },
  { label: 'General Handyman', value: 'GENERAL_HANDYMAN' },
  { label: 'Locksmith', value: 'LOCKSMITH' },
  { label: 'Painting', value: 'PAINTING' },
  { label: 'Landscaping', value: 'LANDSCAPING' },
  { label: 'Cleaning', value: 'CLEANING' },
  { label: 'Appliance Repair', value: 'APPLIANCE_REPAIR' },
  { label: 'Other', value: 'OTHER' },
];

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [tradeType, setTradeType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [isCheckingStripe, setIsCheckingStripe] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  useEffect(() => {
    if (user?.profile) {
      const p = user.profile;
      setBusinessName(p.businessName || '');
      setOwnerName(p.ownerName || '');
      setPhone(p.phone || '');
      setTradeType(p.tradeType || '');
      setLicenseNumber(p.licenseNumber || '');
      setAddress(p.addressLine1 || '');
      setCity(p.city || '');
      setState(p.state || '');
      setZip(p.zip || '');
    }
  }, [user]);

  useEffect(() => {
    subscriptionApi.getSubscription().then(setSubscription).catch(() => {
      // non-critical — fall back to profile data
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await profileApi.updateProfile({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        tradeType: tradeType.trim(),
        licenseNumber: licenseNumber.trim() || undefined,
        addressLine1: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
      });
      await refreshUser();
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectStripe = async () => {
    setIsConnectingStripe(true);
    try {
      const { url } = await profileApi.setupStripe();
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsConnectingStripe(false);
    }
  };

  const handleCheckStripeStatus = async () => {
    setIsCheckingStripe(true);
    try {
      await profileApi.confirmStripeOnboarding();
      await refreshUser();
    } catch {
      // silently ignore — status may still be pending
    } finally {
      setIsCheckingStripe(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const stripeOnboarded = user?.profile?.stripeOnboarded ?? false;
  const stripeStarted = !!(user?.profile?.stripeAccountId);

  const handleOpenPortal = async () => {
    setIsLoadingPortal(true);
    try {
      const url = await subscriptionApi.getPortalUrl();
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const subStatus = subscription?.subscriptionStatus ?? user?.profile?.subscriptionStatus ?? 'trialing';
  const trialEndsAt = subscription?.trialEndsAt ?? user?.profile?.trialEndsAt ?? null;
  const currentPeriodEnd = subscription?.currentPeriodEnd ?? user?.profile?.currentPeriodEnd ?? null;

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  const nextBillingDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Profile</Text>
          <View style={styles.card}>
            <Input
              label="Business Name"
              placeholder="Smith Plumbing LLC"
              value={businessName}
              onChangeText={setBusinessName}
            />
            <Input
              label="Owner Name"
              placeholder="John Smith"
              value={ownerName}
              onChangeText={setOwnerName}
            />
            <Input
              label="Phone"
              placeholder="(555) 123-4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Text style={styles.fieldLabel}>Trade Type</Text>
            <View style={styles.tradeGrid}>
              {TRADE_TYPES.map((trade) => (
                <TouchableOpacity
                  key={trade.value}
                  onPress={() => setTradeType(trade.value)}
                  style={[
                    styles.tradeChip,
                    tradeType === trade.value && styles.tradeChipActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tradeChipText,
                      tradeType === trade.value && styles.tradeChipTextActive,
                    ]}
                  >
                    {trade.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input
              label="License Number"
              placeholder="Optional"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Address</Text>
          <View style={styles.card}>
            <Input
              label="Street Address"
              placeholder="123 Main St"
              value={address}
              onChangeText={setAddress}
            />
            <View style={styles.row}>
              <View style={styles.flex2}>
                <Input
                  label="City"
                  placeholder="City"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={styles.flex1}>
                <Input
                  label="State"
                  placeholder="ST"
                  value={state}
                  onChangeText={setState}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.flex1}>
                <Input
                  label="ZIP"
                  placeholder="12345"
                  value={zip}
                  onChangeText={setZip}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
          </View>
        </View>

        <Button
          title="Save Profile"
          onPress={handleSave}
          loading={isSaving}
          fullWidth
          style={styles.saveButton}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your InvoiceVoice Subscription</Text>
          <View style={styles.card}>
            <View style={styles.subscriptionRow}>
              <View style={[styles.planBadge, subStatus === 'trialing' && styles.planBadgeTrial]}>
                <Text style={styles.planBadgeText}>
                  {subStatus === 'trialing' ? 'Free Trial' : 'Pro Plan'}
                </Text>
              </View>
              <Text style={styles.planPrice}>$29 / month</Text>
            </View>

            {subStatus === 'trialing' && trialDaysLeft !== null && (
              <View style={styles.trialBanner}>
                <Ionicons name="time-outline" size={16} color={colors.accent} />
                <Text style={styles.trialBannerText}>
                  {trialDaysLeft > 0
                    ? `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your free trial`
                    : 'Your trial ends today'}
                </Text>
              </View>
            )}

            {subStatus === 'active' && nextBillingDate && (
              <Text style={styles.subscriptionNote}>
                Next billing date: {nextBillingDate}
              </Text>
            )}

            {subStatus === 'past_due' && (
              <View style={styles.warningBanner}>
                <Ionicons name="warning-outline" size={16} color={colors.accent} />
                <Text style={styles.warningBannerText}>
                  Payment failed — we'll retry automatically. Update your payment method to avoid interruption.
                </Text>
              </View>
            )}

            {(subStatus === 'canceled' || subStatus === 'unpaid') && (
              <View style={styles.errorBanner}>
                <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorBannerText}>
                  Subscription ended. Renew to continue creating invoices.
                </Text>
              </View>
            )}

            <Text style={styles.subscriptionNote}>
              This is your InvoiceVoice subscription — separate from how your customers pay you.
            </Text>

            <Button
              title="Manage Subscription"
              onPress={handleOpenPortal}
              loading={isLoadingPortal}
              variant="outline"
              fullWidth
              style={styles.portalButton}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accept Customer Payments (Optional)</Text>
          <View style={styles.card}>
            {stripeOnboarded ? (
              <>
                <View style={styles.stripeConnected}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  <Text style={styles.stripeConnectedText}>Online Payments Active</Text>
                </View>
                <Text style={styles.stripeDescription}>
                  Customers can pay invoices online with Apple Pay, Google Pay, credit card, or bank transfer. Payments go directly to your bank account.
                </Text>
              </>
            ) : stripeStarted ? (
              <>
                <View style={styles.stripePending}>
                  <Ionicons name="time-outline" size={24} color={colors.accent} />
                  <Text style={styles.stripePendingText}>Setup In Progress</Text>
                </View>
                <Text style={styles.stripeDescription}>
                  You started the payment setup but haven't finished yet. Tap below to continue, or check if it completed.
                </Text>
                <Button
                  title="Continue Setup"
                  onPress={handleConnectStripe}
                  loading={isConnectingStripe}
                  variant="secondary"
                  fullWidth
                  style={styles.stripeButton}
                />
                <Button
                  title="Check Setup Status"
                  onPress={handleCheckStripeStatus}
                  loading={isCheckingStripe}
                  variant="outline"
                  fullWidth
                  style={styles.stripeButton}
                />
              </>
            ) : (
              <>
                <Text style={styles.stripeDescription}>
                  Enable online payments so customers can pay by Apple Pay, Google Pay, credit card, or bank transfer directly from their invoice link. Money goes straight to your bank account.
                </Text>
                <Text style={styles.stripeSteps}>
                  You'll need: your bank account details, SSN or EIN, and a few minutes.
                </Text>
                <Button
                  title="Set Up Online Payments"
                  onPress={handleConnectStripe}
                  loading={isConnectingStripe}
                  variant="secondary"
                  fullWidth
                  style={styles.stripeButton}
                />
                <View style={styles.altPayNote}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.altPayText}>
                    Skip this if you collect payments directly (cash, Venmo, Zelle, check). You can record payments manually on any invoice.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        <Button
          title="Log Out"
          onPress={handleLogout}
          variant="danger"
          fullWidth
          style={styles.logoutButton}
        />

        <Text style={styles.version}>InvoiceVoice v{APP_VERSION}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  saveButton: {
    marginBottom: spacing.xl,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  planBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  planBadgeText: {
    ...typography.captionBold,
    color: colors.white,
  },
  planPrice: {
    ...typography.h4,
    color: colors.text,
  },
  subscriptionNote: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  planBadgeTrial: {
    backgroundColor: colors.accent,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  trialBannerText: {
    ...typography.small,
    color: colors.accent,
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.accentLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  warningBannerText: {
    ...typography.small,
    color: colors.accentDark,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.dangerLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  errorBannerText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
  },
  portalButton: {
    marginTop: spacing.md,
  },
  stripeConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stripeConnectedText: {
    ...typography.bodyBold,
    color: colors.success,
  },
  stripePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stripePendingText: {
    ...typography.bodyBold,
    color: colors.accent,
  },
  stripeSteps: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  stripeDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  stripeButton: {
    marginTop: spacing.xs,
  },
  altPayNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  altPayText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  logoutButton: {
    marginTop: spacing.xl,
  },
  version: {
    ...typography.small,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  fieldLabel: {
    ...typography.captionBold,
    color: colors.gray700,
    marginBottom: spacing.sm,
  },
  tradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  tradeChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: colors.gray50,
    minHeight: 40,
    justifyContent: 'center',
  },
  tradeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tradeChipText: {
    ...typography.caption,
    color: colors.gray700,
  },
  tradeChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
});
