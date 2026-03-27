import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from '../../src/components/Input';
import Button from '../../src/components/Button';
import { useAuth } from '../../src/contexts/AuthContext';
import { getErrorMessage } from '../../src/services/api';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [tradeType, setTradeType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!ownerName.trim()) errors.ownerName = 'Name is required';
    if (!businessName.trim()) errors.businessName = 'Business name is required';
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (!phone.trim()) errors.phone = 'Phone number is required';
    if (!tradeType) errors.tradeType = 'Please select your trade';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        tradeType,
      });
      router.replace('/onboarding');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.appName}>InvoiceVoice</Text>
            <Text style={styles.title}>Create Your Account</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Your Name"
            placeholder="John Smith"
            value={ownerName}
            onChangeText={(text) => {
              setOwnerName(text);
              setFieldErrors((prev) => ({ ...prev, ownerName: '' }));
            }}
            autoComplete="name"
            error={fieldErrors.ownerName}
          />

          <Input
            label="Business Name"
            placeholder="Smith Plumbing LLC"
            value={businessName}
            onChangeText={(text) => {
              setBusinessName(text);
              setFieldErrors((prev) => ({ ...prev, businessName: '' }));
            }}
            error={fieldErrors.businessName}
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setFieldErrors((prev) => ({ ...prev, email: '' }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={fieldErrors.email}
          />

          <Input
            label="Password"
            placeholder="Minimum 8 characters"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setFieldErrors((prev) => ({ ...prev, password: '' }));
            }}
            secureTextEntry
            error={fieldErrors.password}
          />

          <Input
            label="Phone Number"
            placeholder="(555) 123-4567"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setFieldErrors((prev) => ({ ...prev, phone: '' }));
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={fieldErrors.phone}
          />

          <View style={styles.tradeSection}>
            <Text style={styles.tradeLabel}>Trade Type</Text>
            {fieldErrors.tradeType ? (
              <Text style={styles.fieldError}>{fieldErrors.tradeType}</Text>
            ) : null}
            <View style={styles.tradeGrid}>
              {TRADE_TYPES.map((trade) => (
                <TouchableOpacity
                  key={trade.value}
                  onPress={() => {
                    setTradeType(trade.value);
                    setFieldErrors((prev) => ({ ...prev, tradeType: '' }));
                  }}
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
          </View>

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            style={styles.registerButton}
          />

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.linkContainer}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Already have an account?{' '}
              <Text style={styles.linkBold}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  appName: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.base,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  tradeSection: {
    marginBottom: spacing.base,
  },
  tradeLabel: {
    ...typography.captionBold,
    color: colors.gray700,
    marginBottom: spacing.sm,
  },
  fieldError: {
    ...typography.small,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  tradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tradeChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: colors.gray50,
    minHeight: 44,
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
  registerButton: {
    marginTop: spacing.sm,
  },
  linkContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    padding: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  linkBold: {
    color: colors.primary,
    fontWeight: '600',
  },
});
