import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { api } from '../api/client';
import BidCard from '../components/BidCard';

type Props = NativeStackScreenProps<RootStackParamList, 'JobDetail'>;

const STATUS_STEPS = ['OPEN', 'IN_PROGRESS', 'DELIVERED', 'VALIDATING', 'COMPLETED'] as const;

const statusColors: Record<string, string> = {
  OPEN: '#4CC9F0',
  IN_PROGRESS: '#eab308',
  DELIVERED: '#818cf8',
  VALIDATING: '#f97316',
  COMPLETED: '#22c55e',
  DISPUTED: '#ef4444',
};

export default function JobDetailScreen({ navigation, route }: Props) {
  const { jobId } = route.params;
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJob();
  }, []);

  const fetchJob = async () => {
    try {
      const result = await (api as any).getJob?.(jobId);
      if (result) {
        setJob(result);
      } else {
        // Fallback: fetch from feed and find
        const feed = (await api.getJobFeed()) as { jobs: any[] };
        const found = feed.jobs?.find((j: any) => j.id === jobId);
        setJob(found || null);
      }
    } catch {
      setJob(null);
    }
    setLoading(false);
  };

  const handleAcceptBid = (bidId: number) => {
    Alert.alert('Accept Bid', 'Are you sure you want to accept this bid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: () => {
          // API call to accept bid
        },
      },
    ]);
  };

  const handleRejectBid = (bidId: number) => {
    Alert.alert('Reject Bid', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          // API call to reject bid
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CC9F0" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Job not found</Text>
      </View>
    );
  }

  const currentStepIdx = STATUS_STEPS.indexOf(job.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status timeline */}
      <View style={styles.timeline}>
        {STATUS_STEPS.map((step, i) => {
          const isActive = i <= currentStepIdx;
          const isCurrent = i === currentStepIdx;
          const color = isActive
            ? statusColors[step] || '#4CC9F0'
            : '#2a2a4a';

          return (
            <View key={step} style={styles.timelineStep}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: color },
                  isCurrent && styles.stepDotCurrent,
                ]}
              />
              <Text
                style={[
                  styles.stepLabel,
                  { color: isActive ? '#e0e0e0' : '#6a6a8a' },
                  isCurrent && { fontWeight: '700' },
                ]}
              >
                {step.replace('_', '\n')}
              </Text>
              {i < STATUS_STEPS.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    { backgroundColor: isActive ? color : '#2a2a4a' },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Job details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {job.title || job.description?.slice(0, 60) || 'Untitled'}
        </Text>
        <Text style={styles.description}>{job.description}</Text>

        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Budget</Text>
            <Text style={styles.detailValue}>{job.budget || '0'} USDC</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Deadline</Text>
            <Text style={styles.detailValue}>
              {job.deadline
                ? new Date(job.deadline).toLocaleDateString()
                : 'None'}
            </Text>
          </View>
        </View>

        {job.criteria?.length > 0 && (
          <View style={styles.criteriaSection}>
            <Text style={styles.sectionLabel}>Success Criteria</Text>
            {job.criteria.map((c: any, i: number) => (
              <View key={i} style={styles.criterionItem}>
                <Text style={styles.criterionBullet}>-</Text>
                <Text style={styles.criterionText}>{c.description}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Bids section */}
      {job.status === 'OPEN' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Bids ({job.bids?.length || 0})
          </Text>
          {(job.bids || []).map((bid: any) => (
            <BidCard
              key={bid.id}
              bid={{
                id: bid.id,
                agentName: bid.agentName || bid.agent_address?.slice(0, 10) || 'Agent',
                price: bid.price || bid.amount || '0',
                deliveryTime: bid.deliveryTime || bid.delivery_time || 'N/A',
                reputationScore: bid.reputationScore || bid.reputation || 0,
                criteriaBitmask: bid.criteriaBitmask,
              }}
              totalCriteria={job.criteria?.length || 0}
              onAccept={() => handleAcceptBid(bid.id)}
              onReject={() => handleRejectBid(bid.id)}
            />
          ))}
          {(!job.bids || job.bids.length === 0) && (
            <Text style={styles.noBids}>No bids yet. Agents will bid soon.</Text>
          )}
        </View>
      )}

      {/* Delivery section */}
      {(job.status === 'DELIVERED' || job.status === 'VALIDATING') && job.delivery && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery</Text>
          <View style={styles.deliveryRow}>
            <Text style={styles.detailLabel}>Proof Hash</Text>
            <Text style={styles.hashText} numberOfLines={1}>
              {job.delivery.proofHash}
            </Text>
          </View>
          {job.delivery.evidenceUri && (
            <View style={styles.deliveryRow}>
              <Text style={styles.detailLabel}>Evidence</Text>
              <Text style={styles.linkText}>{job.delivery.evidenceUri}</Text>
            </View>
          )}
          <View style={styles.deliveryRow}>
            <Text style={styles.detailLabel}>Validation</Text>
            <Text
              style={[
                styles.detailValue,
                {
                  color:
                    job.delivery.validationStatus === 'passed'
                      ? '#22c55e'
                      : '#eab308',
                },
              ]}
            >
              {job.delivery.validationStatus || 'Pending'}
            </Text>
          </View>

          <View style={styles.deliveryActions}>
            <TouchableOpacity style={styles.approveBtn}>
              <Text style={styles.approveBtnText}>Approve Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.overrideBtn}>
              <Text style={styles.overrideBtnText}>Override Validation</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Chat button */}
      {job.status !== 'OPEN' && job.status !== 'COMPLETED' && (
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => navigation.navigate('Chat', { jobId })}
        >
          <Text style={styles.chatBtnText}>Chat with Agent</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0f0f23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  stepDotCurrent: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#0f0f23',
  },
  stepLabel: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },
  stepLine: {
    position: 'absolute',
    top: 8,
    left: '60%',
    right: '-40%',
    height: 2,
    zIndex: -1,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cardTitle: {
    color: '#e0e0e0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: '#a0a0b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    color: '#6a6a8a',
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '600',
  },
  criteriaSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    paddingTop: 12,
  },
  sectionLabel: {
    color: '#a0a0b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  criterionItem: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  criterionBullet: {
    color: '#4CC9F0',
    fontSize: 14,
  },
  criterionText: {
    color: '#e0e0e0',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  noBids: {
    color: '#6a6a8a',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  deliveryRow: {
    marginBottom: 10,
  },
  hashText: {
    color: '#e0e0e0',
    fontSize: 13,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  linkText: {
    color: '#4CC9F0',
    fontSize: 13,
    marginTop: 2,
  },
  deliveryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#0f0f23',
    fontWeight: '700',
    fontSize: 14,
  },
  overrideBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f97316',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  overrideBtnText: {
    color: '#f97316',
    fontWeight: '700',
    fontSize: 14,
  },
  chatBtn: {
    backgroundColor: '#4CC9F0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  chatBtnText: {
    color: '#0f0f23',
    fontWeight: '700',
    fontSize: 16,
  },
});
