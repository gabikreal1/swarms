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
import * as Clipboard from 'expo-clipboard';
import { createPublicClient, http, formatUnits } from 'viem';
import { useTheme } from '../../src/theme/useTheme';
import { api } from '../../src/api/client';
import { initWallet, WalletState } from '../../src/wallet/circle';
import { arcTestnet } from '../../src/config/chains';
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
  const [minting, setMinting] = useState(false);
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
      const raw = await publicClient.getBalance({
        address: wallet.address as `0x${string}`,
      });
      setBalance(formatUnits(raw, 6));
    } catch {
      setBalance('—');
    }
  }, [wallet]);

  const copyAddress = async () => {
    if (!wallet?.address) return;
    await Clipboard.setStringAsync(wallet.address);
    Alert.alert('Copied', 'Wallet address copied to clipboard');
  };

  const mintMockUSDC = async () => {
    if (!wallet?.address) return;
    setMinting(true);
    try {
      const res = await fetch(`${arcTestnet.rpcUrls.default.http[0]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendTransaction',
          params: [{
            from: '0x0000000000000000000000000000000000000000',
            to: wallet.address,
            value: '0x' + (100_000_000).toString(16), // 100 USDC (6 decimals)
          }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      Alert.alert('Minted!', '100 mock USDC sent to your wallet');
      await fetchBalance();
    } catch {
      // Testnet faucet fallback — many testnets don't allow arbitrary minting via RPC.
      // Try a direct faucet endpoint if available.
      try {
        const faucetRes = await fetch(
          `https://faucet.testnet.arc.network/api/faucet`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: wallet.address }),
          },
        );
        if (faucetRes.ok) {
          Alert.alert('Minted!', 'Testnet USDC requested from faucet');
          await fetchBalance();
        } else {
          Alert.alert('Faucet', 'Testnet faucet unavailable. Try again later.');
        }
      } catch {
        Alert.alert('Faucet', 'Could not reach testnet faucet. Try again later.');
      }
    } finally {
      setMinting(false);
    }
  };

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
      {/* Wallet Status */}
      <Section header="Wallet">
        <SectionRow
          label={
            wallet?.isConnected
              ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
              : 'Not connected'
          }
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
          accessory="disclosure"
          onPress={async () => {
            if (!wallet?.isConnected) {
              try {
                const w = await initWallet();
                setWallet(w);
              } catch (e: any) {
                Alert.alert('Wallet Error', e?.message || 'Failed to connect wallet');
              }
            } else {
              await copyAddress();
            }
          }}
        />
        {wallet?.isConnected && (
          <>
            <SectionRow
              label="Balance"
              value={balance !== null ? `${balance} USDC` : 'Loading...'}
              icon={
                <Ionicons name="cash-outline" size={22} color={colors.systemGreen} />
              }
            />
            <SectionRow
              label="Copy Address"
              icon={
                <Ionicons name="copy-outline" size={22} color={colors.tint} />
              }
              accessory="disclosure"
              onPress={copyAddress}
            />
            <SectionRow
              label="Mint 100 Mock USDC"
              icon={
                <Ionicons name="add-circle-outline" size={22} color={colors.systemOrange} />
              }
              accessory="disclosure"
              isLast
              onPress={mintMockUSDC}
            />
          </>
        )}
        {!wallet?.isConnected && (
          <SectionRow
            label="Tap to connect"
            icon={
              <Ionicons name="log-in-outline" size={22} color={colors.tint} />
            }
            isLast
          />
        )}
      </Section>
      {minting && (
        <View style={styles.mintingBanner}>
          <ActivityIndicator size="small" color={colors.systemOrange} />
          <Text style={[typography.subheadline, { color: colors.secondaryLabel, marginLeft: 8 }]}>
            Minting USDC...
          </Text>
        </View>
      )}

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
  mintingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
});
