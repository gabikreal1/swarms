import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/useTheme';
import { api } from '../src/api/client';
import { Section } from '../src/components/ios/Section';

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function reputationTier(score: number) {
  if (score >= 0.9) return { label: 'Excellent', color: '#30D158' };
  if (score >= 0.75) return { label: 'Good', color: '#0A84FF' };
  if (score >= 0.5) return { label: 'Average', color: '#FFD60A' };
  return { label: 'New', color: '#FF9F0A' };
}

export default function AgentsScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.getAgents();
      setAgents(res.data || []);
    } catch {
      setAgents([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAgents();
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
      }
    >
      {agents.length > 0 ? (
        <Section header={`${agents.length} Agent${agents.length !== 1 ? 's' : ''}`}>
          <View style={{ padding: spacing.cellHorizontal }}>
            {agents.map((agent, idx) => {
              const rep = reputationTier(agent.reputation || 0);
              const pct = Math.round((agent.reputation || 0) * 100);

              return (
                <View
                  key={agent.address || idx}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.secondarySystemGroupedBackground,
                      borderColor: colors.separator,
                    },
                  ]}
                >
                  {/* Header */}
                  <View style={styles.header}>
                    <View style={styles.agentInfo}>
                      <View style={[styles.avatar, { backgroundColor: colors.tint + '33' }]}>
                        <Text style={[styles.avatarText, { color: colors.tint }]}>
                          {(agent.name || 'A').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.agentName, { color: colors.label }]}>
                          {agent.name || 'Unknown Agent'}
                        </Text>
                        {agent.address && (
                          <TouchableOpacity
                            style={styles.addressRow}
                            onPress={() => Clipboard.setStringAsync(agent.address)}
                          >
                            <Text style={[styles.address, { color: colors.tertiaryLabel }]}>
                              {shortenAddress(agent.address)}
                            </Text>
                            <Ionicons name="copy-outline" size={12} color={colors.tertiaryLabel} style={{ marginLeft: 4 }} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Status pill */}
                    <View style={[styles.statusPill, { backgroundColor: (agent.status === 'active' ? colors.systemGreen : colors.systemGray) + '1A' }]}>
                      <View style={[styles.statusDot, { backgroundColor: agent.status === 'active' ? colors.systemGreen : colors.systemGray }]} />
                      <Text style={[styles.statusText, { color: agent.status === 'active' ? colors.systemGreen : colors.systemGray }]}>
                        {agent.status || 'unknown'}
                      </Text>
                    </View>
                  </View>

                  {/* Stats row */}
                  <View style={styles.stats}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.tertiaryLabel }]}>Reputation</Text>
                      <Text style={[styles.statValue, { color: rep.color }]}>
                        {pct}% · {rep.label}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.tertiaryLabel }]}>Jobs</Text>
                      <Text style={[styles.statValue, { color: colors.label }]}>
                        {agent.completedJobs ?? 0}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.tertiaryLabel }]}>Success</Text>
                      <Text style={[styles.statValue, { color: colors.label }]}>
                        {Math.round((agent.successRate || 0) * 100)}%
                      </Text>
                    </View>
                  </View>

                  {/* Capabilities */}
                  {agent.capabilities?.length > 0 && (
                    <View style={styles.capsRow}>
                      {agent.capabilities.map((cap: string) => (
                        <View key={cap} style={[styles.capPill, { backgroundColor: colors.systemFill }]}>
                          <Text style={[styles.capText, { color: colors.secondaryLabel }]}>{cap}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Section>
      ) : (
        <View style={styles.empty}>
          <Text style={[typography.title3, { color: colors.label, textAlign: 'center' }]}>
            No agents registered yet
          </Text>
          <Text style={[typography.subheadline, { color: colors.secondaryLabel, textAlign: 'center', marginTop: 4 }]}>
            Agents will appear here once they register on the marketplace
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  agentName: { fontSize: 15, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  address: { fontSize: 11, fontFamily: 'Courier' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  stats: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  statItem: { flex: 1 },
  statLabel: { fontSize: 11, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '600' },
  capsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  capPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  capText: { fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
});
