import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/useTheme';

export type TxStep = 'checking' | 'approving' | 'posting' | 'confirmed' | 'failed';

interface TransactionStatusProps {
  step: TxStep;
  txHash?: string;
  errorMessage?: string;
}

const STEP_LABELS: Record<TxStep, string> = {
  checking: 'Checking allowance...',
  approving: 'Approving USDC...',
  posting: 'Posting job...',
  confirmed: 'Confirmed!',
  failed: 'Failed',
};

function shortenHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export default function TransactionStatus({ step, txHash, errorMessage }: TransactionStatusProps) {
  const { colors } = useTheme();

  const isPending = step === 'checking' || step === 'approving' || step === 'posting';
  const isConfirmed = step === 'confirmed';
  const isFailed = step === 'failed';

  const handleCopyHash = async () => {
    if (txHash) {
      await Clipboard.setStringAsync(txHash);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {isPending && <ActivityIndicator size="small" color={colors.tint} />}
        {isConfirmed && (
          <View style={[styles.icon, { backgroundColor: colors.systemGreen }]}>
            <Text style={styles.iconText}>✓</Text>
          </View>
        )}
        {isFailed && (
          <View style={[styles.icon, { backgroundColor: colors.systemRed }]}>
            <Text style={styles.iconText}>✕</Text>
          </View>
        )}
        <Text
          style={[
            styles.label,
            {
              color: isFailed
                ? colors.systemRed
                : isConfirmed
                  ? colors.systemGreen
                  : colors.label,
            },
          ]}
        >
          {STEP_LABELS[step]}
        </Text>
      </View>

      {isFailed && errorMessage && (
        <Text style={[styles.error, { color: colors.systemRed }]}>{errorMessage}</Text>
      )}

      {txHash && (
        <Pressable onPress={handleCopyHash} style={styles.hashRow}>
          <Text style={[styles.hash, { color: colors.secondaryLabel }]}>
            Tx: {shortenHash(txHash)}
          </Text>
          <Text style={[styles.copyHint, { color: colors.tertiaryLabel }]}>tap to copy</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    marginLeft: 34,
  },
  hashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 34,
  },
  hash: {
    fontSize: 13,
    fontFamily: 'Courier',
  },
  copyHint: {
    fontSize: 11,
  },
});
