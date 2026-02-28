import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { api } from '../api/client';
import { initWallet, WalletState } from '../wallet/circle';
import JobCard from '../components/JobCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
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
      // Feed may not be available yet
      setJobs([]);
    }
  }, [wallet]);

  useEffect(() => {
    (async () => {
      try {
        const w = await initWallet();
        setWallet(w);
      } catch {
        // Wallet init may fail in dev
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchJobs();
    }
  }, [loading, fetchJobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  const renderHeader = () => (
    <View>
      {/* Wallet status */}
      <View style={styles.walletCard}>
        <View style={styles.walletRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: wallet?.isConnected ? '#22c55e' : '#ef4444' },
            ]}
          />
          <Text style={styles.walletLabel}>
            {wallet?.isConnected
              ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
              : 'Wallet not connected'}
          </Text>
        </View>
        {!wallet?.isConnected && (
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={async () => {
              try {
                const w = await initWallet();
                setWallet(w);
              } catch {}
            }}
          >
            <Text style={styles.connectBtnText}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PostJob', {})}
        >
          <Text style={styles.actionIcon}>+</Text>
          <Text style={styles.actionText}>Post a Job</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnAlt]}>
          <Text style={styles.actionIcon}>&#9776;</Text>
          <Text style={styles.actionText}>Browse Agents</Text>
        </TouchableOpacity>
      </View>

      {/* Section heading */}
      <Text style={styles.sectionTitle}>Active Jobs</Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      {loading ? (
        <ActivityIndicator size="large" color="#4CC9F0" />
      ) : (
        <>
          <Text style={styles.emptyTitle}>No jobs yet</Text>
          <Text style={styles.emptySubtitle}>
            Post your first job to get started
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => (
          <JobCard
            job={{
              id: item.id,
              title: item.title || item.description?.slice(0, 60) || 'Untitled',
              status: item.status || 'OPEN',
              budget: item.budget || '0',
              deadline: item.deadline
                ? new Date(item.deadline).toLocaleDateString()
                : 'No deadline',
              bidCount: item.bidCount ?? item.bids?.length ?? 0,
              category: item.category,
              tags: item.tags,
            }}
            onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4CC9F0"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  walletCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  walletLabel: {
    color: '#e0e0e0',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  connectBtn: {
    backgroundColor: '#4CC9F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  connectBtnText: {
    color: '#0f0f23',
    fontWeight: '700',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#4CC9F0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  actionBtnAlt: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4CC9F0',
  },
  actionIcon: {
    color: '#0f0f23',
    fontSize: 22,
    fontWeight: '700',
  },
  actionText: {
    color: '#0f0f23',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#e0e0e0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#6a6a8a',
    fontSize: 14,
    marginTop: 4,
  },
});
