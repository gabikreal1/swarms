import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
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
import { normalizeStatus, statusLabel, getStatusColor } from '../../src/utils/status';
import { formatDeadline } from '../../src/utils/deadline';

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export default function HomeTab() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');

  const fetchJobs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filterMode === 'mine' && wallet?.address) {
        params.poster = wallet.address;
      }
      const result = (await api.getJobFeed(params)) as { jobs: any[] };
      setJobs(result.jobs || []);
    } catch {
      setJobs([]);
    }
  }, [wallet, filterMode]);

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
          title="New Chat"
          variant="tinted"
          onPress={() => router.push('/(tabs)/butler')}
          style={styles.actionBtn}
        />
        <Button
          title="Browse Agents"
          variant="gray"
          onPress={() => {}}
          style={styles.actionBtn}
        />
      </View>

      {/* Filter Toggle */}
      <View style={[styles.segmentedControl, { backgroundColor: colors.systemFill }]}>
        <TouchableOpacity
          style={[
            styles.segment,
            filterMode === 'all' && { backgroundColor: colors.systemBackground },
          ]}
          onPress={() => setFilterMode('all')}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color: filterMode === 'all' ? colors.label : colors.secondaryLabel,
                fontWeight: filterMode === 'all' ? '600' : '400',
              },
            ]}
          >
            All Jobs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segment,
            filterMode === 'mine' && { backgroundColor: colors.systemBackground },
          ]}
          onPress={() => setFilterMode('mine')}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color: filterMode === 'mine' ? colors.label : colors.secondaryLabel,
                fontWeight: filterMode === 'mine' ? '600' : '400',
              },
            ]}
          >
            My Jobs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Job List */}
      {jobs.length > 0 ? (
        <Section header={filterMode === 'mine' ? 'My Jobs' : 'All Marketplace Jobs'}>
          {jobs.map((item, index) => {
            const title = item.title || item.description?.slice(0, 60) || 'Untitled';
            const status = normalizeStatus(item.status);
            const budget = `${item.budget || '0'} USDC`;
            const bidCount = item.bids?.length || item.bidCount || 0;
            const statusColor = getStatusColor(status, colors);

            // Build detail string with bid count
            const detailParts = [budget];
            if (bidCount > 0) {
              detailParts.push(`${bidCount} bid${bidCount !== 1 ? 's' : ''}`);
            }
            const deadline = formatDeadline(item.deadline);
            if (deadline !== 'None') detailParts.push(deadline);

            return (
              <SectionRow
                key={item.id}
                label={title}
                detail={detailParts.join(' · ')}
                accessory="badge"
                badgeText={statusLabel(status)}
                badgeColor={statusColor}
                icon={
                  bidCount > 0 && status === 'open' ? (
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
            {filterMode === 'mine' ? 'No jobs posted yet' : 'No jobs yet'}
          </Text>
          <Text
            style={[
              typography.subheadline,
              { color: colors.secondaryLabel, textAlign: 'center', marginTop: 4 },
            ]}
          >
            Chat with Butler to post your first job
          </Text>
          <Button
            title="New Chat"
            variant="filled"
            onPress={() => router.push('/(tabs)/butler')}
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
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
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
