import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createPublicClient, http, formatUnits, erc20Abi } from 'viem';
import { useTheme } from '../../src/theme/useTheme';
import { api } from '../../src/api/client';
import { initWallet, WalletState } from '../../src/wallet/circle';
import { arcTestnet, USDC_ADDRESS, USDC_DECIMALS } from '../../src/config/chains';
import { Section } from '../../src/components/ios/Section';
import { SectionRow } from '../../src/components/ios/SectionRow';
import { Button } from '../../src/components/ios/Button';

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const statusToSystemColor: Record<string, string> = {};

function useStatusColor(status: string, colors: any) {
  const map: Record<string, string> = {
    OPEN: colors.systemBlue,
    IN_PROGRESS: colors.systemYellow,
    DELIVERED: colors.systemIndigo,
    VALIDATING: colors.systemOrange,
    COMPLETED: colors.systemGreen,
    DISPUTED: colors.systemRed,
  };
  return map[status] || colors.tertiaryLabel;
}

export default function HomeTab() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (wallet?.address) {
        params.poster = wallet.address;
      }
      const result = (await api.getJobFeed(params)) as { jobs: any[] };
      setJobs(result.jobs || []);
    } catch {
      setJobs([]);
    }
  }, [wallet]);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) return;
    try {
      const raw = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet.address as `0x${string}`],
      });
      setBalance(formatUnits(raw, USDC_DECIMALS));
    } catch {
      setBalance('0');
    }
  }, [wallet]);


  useEffect(() => {
    (async () => {
      try {
        const w = await initWallet();
        setWallet(w);
      } catch (e: any) {
        console.error('[wallet] Auto-init failed:', e?.message || e);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchJobs();
      fetchBalance();
    }
  }, [loading, fetchJobs, fetchBalance]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchJobs(), fetchBalance()]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.systemGroupedBackground }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.tint}
        />
      }
    >
      {/* Wallet */}
      <Section header="Wallet">
        <SectionRow
          label={
            wallet?.isConnected
              ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
              : 'Not connected'
          }
          value={wallet?.isConnected && balance !== null ? `${balance} USDC` : undefined}
          icon={
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: wallet?.isConnected
                    ? colors.systemGreen
                    : colors.systemRed,
                },
              ]}
            />
          }
          isLast
          onPress={async () => {
            if (!wallet?.isConnected) {
              try {
                const w = await initWallet();
                setWallet(w);
              } catch (e: any) {
                Alert.alert('Wallet Error', e?.message || 'Failed to connect wallet');
              }
            }
          }}
        />
      </Section>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <Button
          title="Post Job"
          variant="tinted"
          onPress={() => router.push('/(tabs)/post')}
          style={styles.actionBtn}
        />
        <Button
          title="Browse Agents"
          variant="gray"
          onPress={() => {}}
          style={styles.actionBtn}
        />
      </View>

      {/* Job List */}
      {jobs.length > 0 ? (
        <Section header="Active Jobs">
          {jobs.map((item, index) => {
            const title = item.title || item.description?.slice(0, 60) || 'Untitled';
            const status = item.status || 'OPEN';
            const budget = `${item.budget || '0'} USDC`;
            const deadline = item.deadline
              ? new Date(item.deadline).toLocaleDateString()
              : 'No deadline';

            return (
              <SectionRow
                key={item.id}
                label={title}
                detail={`${budget} · ${deadline}`}
                accessory="badge"
                badgeText={status.replace('_', ' ')}
                badgeColor={useStatusColor(status, colors)}
                isLast={index === jobs.length - 1}
                onPress={() => router.push(`/job/${item.id}`)}
              />
            );
          })}
        </Section>
      ) : (
        <View style={styles.empty}>
          <Text style={[typography.title3, { color: colors.label, textAlign: 'center' }]}>
            No jobs yet
          </Text>
          <Text
            style={[
              typography.subheadline,
              { color: colors.secondaryLabel, textAlign: 'center', marginTop: 4 },
            ]}
          >
            Post your first job to get started
          </Text>
          <Button
            title="Post Job"
            variant="filled"
            onPress={() => router.push('/(tabs)/post')}
            style={{ marginTop: 20, width: 200 }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
  },
  actionBtn: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
});
