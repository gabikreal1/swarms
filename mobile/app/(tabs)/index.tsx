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

function getStatusColor(status: string, colors: any): string {
  const map: Record<string, string> = {
    OPEN: colors.systemGreen,
    IN_PROGRESS: colors.systemBlue,
    DELIVERED: colors.systemOrange,
    VALIDATING: colors.systemIndigo,
    COMPLETED: colors.tertiaryLabel,
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
            const bidCount = item.bids?.length || item.bidCount || 0;
            const statusColor = getStatusColor(status, colors);

            // Build detail string with bid count
            const detailParts = [budget];
            if (bidCount > 0) {
              detailParts.push(`${bidCount} bid${bidCount !== 1 ? 's' : ''}`);
            }
            const deadline = item.deadline
              ? new Date(item.deadline).toLocaleDateString()
              : null;
            if (deadline) detailParts.push(deadline);

            return (
              <SectionRow
                key={item.id}
                label={title}
                detail={detailParts.join(' · ')}
                accessory="badge"
                badgeText={status.replace('_', ' ')}
                badgeColor={statusColor}
                icon={
                  bidCount > 0 && status === 'OPEN' ? (
                    <View style={[styles.bidCountBadge, { backgroundColor: colors.systemOrange }]}>
                      <Text style={styles.bidCountText}>{bidCount}</Text>
                    </View>
                  ) : undefined
                }
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
  bidCountBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
});
