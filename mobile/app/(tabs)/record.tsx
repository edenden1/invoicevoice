import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import RecordButton from '../../src/components/RecordButton';
import { useAudioRecorder, formatDuration } from '../../src/services/audio';
import { invoiceApi, getErrorMessage } from '../../src/services/api';
import { colors, spacing, typography } from '../../src/theme';

export default function RecordScreen() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const processUri = async (uri: string | null) => {
    if (!uri) return;
    setIsProcessing(true);
    try {
      const invoice = await invoiceApi.createFromVoice(uri);
      router.push({
        pathname: '/invoice/preview',
        params: { invoiceId: invoice.id },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const { isRecording, recordingDuration, startRecording, stopRecording } = useAudioRecorder(processUri);

  const handlePress = async () => {
    setError('');

    if (isRecording) {
      const uri = await stopRecording();
      await processUri(uri);
    } else {
      try {
        await startRecording();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    }
  };

  if (isProcessing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.processingTitle}>Processing Your Voice...</Text>
            <Text style={styles.processingSubtext}>
              Our AI is extracting invoice details from your recording.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <Text style={styles.screenTitle}>
            {isRecording ? 'Recording...' : 'Create Invoice'}
          </Text>
          <Text style={styles.instructions}>
            {isRecording
              ? 'Tap to stop recording'
              : 'Tap to start recording. Describe the job, customer, and charges.'}
          </Text>
        </View>

        <View style={styles.centerSection}>
          {isRecording ? (
            <Text style={styles.timer}>{formatDuration(recordingDuration)}</Text>
          ) : null}

          <RecordButton isRecording={isRecording} onPress={handlePress} />

          {isRecording ? (
            <Text style={styles.recordingHint}>Listening...</Text>
          ) : null}
        </View>

        <View style={styles.bottomSection}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!isRecording ? (
            <View style={styles.exampleBox}>
              <Text style={styles.exampleLabel}>Try saying:</Text>
              <Text style={styles.exampleText}>
                "Fixed a leaky faucet for John Smith at 123 Main St. Two hours labor at $85 per
                hour, plus a $45 faucet cartridge."
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  screenTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  instructions: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.base,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    ...typography.h1,
    fontSize: 48,
    color: colors.danger,
    marginBottom: spacing.xl,
    fontVariant: ['tabular-nums'],
  },
  recordingHint: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.base,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bottomSection: {
    paddingBottom: spacing.xxl,
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  exampleBox: {
    backgroundColor: colors.gray50,
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  exampleLabel: {
    ...typography.captionBold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  exampleText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.base,
  },
  processingTitle: {
    ...typography.h3,
    color: colors.text,
  },
  processingSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});
