import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import {
  signAndSendTransaction,
  waitForReceipt,
  checkAllowance,
  approveUSDC,
  getAccount,
} from '../../wallet/circle';

interface TransactionBlockProps {
  transaction: {
    to: string;
    data: string;
    value: string;
    chainId?: number;
  };
  title?: string;
  budget?: number;
  criteriaCount?: number;
  approval?: {
    spender: string;
    amount: string;
  };
  onConfirmed: (txHash: string) => void;
}

export default function TransactionBlock({
  transaction,
  title,
  budget,
  criteriaCount,
  approval,
  onConfirmed,
}: TransactionBlockProps) {
  const { colors, typography } = useTheme();
  const [status, setStatus] = useState<'idle' | 'approving' | 'signing' | 'confirming' | 'confirmed' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSign = async () => {
    try {
      // If approval needed (e.g. USDC for escrow), handle it first
      if (approval?.spender && approval?.amount) {
        const amount = BigInt(approval.amount);
        if (amount > 0n) {
          setStatus('approving');
          const account = await getAccount();
          const currentAllowance = await checkAllowance(
            account.address,
            approval.spender as `0x${string}`,
          );
          if (currentAllowance < amount) {
            const approveHash = await approveUSDC(
              approval.spender as `0x${string}`,
              amount,
            );
            await waitForReceipt(approveHash as `0x${string}`);
          }
        }
      }

      setStatus('signing');
      const hash = await signAndSendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || '0',
      });

      setTxHash(hash as string);
      setStatus('confirming');

      const receipt = await waitForReceipt(hash as `0x${string}`);

      if (receipt.status === 'success') {
        setStatus('confirmed');
        onConfirmed(hash as string);
      } else {
        setStatus('error');
        Alert.alert('Transaction Failed', 'The transaction was reverted. Please try again.');
      }
    } catch (e: any) {
      setStatus('error');
      Alert.alert('Transaction Error', e?.message || 'Failed to sign transaction');
    }
  };

  const statusLabel =
    status === 'approving' ? 'Approving USDC...' :
    status === 'signing' ? 'Signing...' :
    status === 'confirming' ? 'Confirming...' : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.tertiarySystemBackground, borderColor: colors.separator }]}>
      <View style={styles.header}>
        <Ionicons name="document-text-outline" size={20} color={colors.tint} />
        <Text style={[styles.headerText, { color: colors.label }]}>{title || 'Transaction'}</Text>
      </View>

      <View style={styles.row}>
        {budget != null && (
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.tertiaryLabel }]}>Budget</Text>
            <Text style={[styles.statValue, { color: colors.label }]}>{budget} USDC</Text>
          </View>
        )}
        {criteriaCount != null && criteriaCount > 0 && (
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.tertiaryLabel }]}>Criteria</Text>
            <Text style={[styles.statValue, { color: colors.label }]}>{criteriaCount}</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.tertiaryLabel }]}>Contract</Text>
          <Text style={[styles.statValue, { color: colors.label }]}>
            {transaction.to.slice(0, 6)}...{transaction.to.slice(-4)}
          </Text>
        </View>
      </View>

      {status === 'confirmed' ? (
        <View style={[styles.confirmedBanner, { backgroundColor: colors.systemGreen + '1A' }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.systemGreen} />
          <Text style={[styles.confirmedText, { color: colors.systemGreen }]}>
            Transaction confirmed
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.signBtn,
            { backgroundColor: colors.tint },
            statusLabel != null && { opacity: 0.6 },
          ]}
          onPress={handleSign}
          disabled={statusLabel != null}
        >
          {statusLabel ? (
            <>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.signBtnText}>{statusLabel}</Text>
            </>
          ) : status === 'error' ? (
            <Text style={styles.signBtnText}>Retry</Text>
          ) : (
            <Text style={styles.signBtnText}>Sign & Submit</Text>
          )}
        </TouchableOpacity>
      )}

      {txHash && (
        <Text style={[styles.txHash, { color: colors.tertiaryLabel }]}>
          tx: {txHash.slice(0, 14)}...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  signBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  signBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  confirmedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  txHash: {
    fontSize: 11,
    fontFamily: 'Courier',
    textAlign: 'center',
  },
});
