import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { api } from '../../src/api/client';
import { Section } from '../../src/components/ios/Section';
import { SectionRow } from '../../src/components/ios/SectionRow';
import { Button } from '../../src/components/ios/Button';
import BidCard from '../../src/components/BidCard';

const STATUS_STEPS = ['OPEN', 'IN_PROGRESS', 'DELIVERED', 'VALIDATING', 'COMPLETED'] as const;

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJob();
  }, []);

  const fetchJob = async () => {
    try {
      const result = await api.getJob(id!);
      if (result) {
        setJob(result);
      } else {
        const feed = (await api.getJobFeed()) as { jobs: any[] };
        const found = feed.jobs?.find((j: any) => String(j.id) === id);
        setJob(found || null);
      }
    } catch {
      setJob(null);
    }
    setLoading(false);
  };

  const statusColorMap: Record<string, string> = {
    OPEN: colors.systemBlue,
    IN_PROGRESS: colors.systemYellow,
    DELIVERED: colors.systemIndigo,
    VALIDATING: colors.systemOrange,
    COMPLETED: colors.systemGreen,
    DISPUTED: colors.systemRed,
  };

  const handleAcceptBid = (bidId: number) => {
    Alert.alert('Accept Bid', 'Are you sure you want to accept this bid?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => {} },
    ]);
  };

  const handleRejectBid = (bidId: number) => {
    Alert.alert('Reject Bid', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => {} },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.systemGroupedBackground }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.systemGroupedBackground }]}>
        <Text style={[typography.headline, { color: colors.systemRed }]}>
          Job not found
        </Text>
      </View>
    );
  }

  const currentStepIdx = STATUS_STEPS.indexOf(job.status);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
      contentContainerStyle={styles.content}
    >
      {/* Status Timeline */}
      <View style={styles.timeline}>
        {STATUS_STEPS.map((step, i) => {
          const isActive = i <= currentStepIdx;
          const isCurrent = i === currentStepIdx;
          const color = isActive
            ? statusColorMap[step] || colors.tint
            : colors.quaternaryLabel;

          return (
            <View key={step} style={styles.timelineStep}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: color },
                  isCurrent && {
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 3,
                    borderColor: colors.systemGroupedBackground,
                  },
                ]}
              />
              <Text
                style={[
                  typography.caption2,
                  {
                    color: isActive ? colors.label : colors.tertiaryLabel,
                    fontWeight: isCurrent ? '700' : '400',
                    textAlign: 'center',
                    marginTop: 4,
                  },
                ]}
              >
                {step.replace('_', '\n')}
              </Text>
              {i < STATUS_STEPS.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    { backgroundColor: isActive ? color : colors.quaternaryLabel },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Job Info */}
      <Section header="Job Details">
        <SectionRow
          label="Title"
          detail={job.title || job.description?.slice(0, 60) || 'Untitled'}
        />
        {job.description && (
          <SectionRow
            label="Description"
            detail={job.description}
          />
        )}
        <SectionRow
          label="Budget"
          value={`${job.budget || '0'} USDC`}
        />
        <SectionRow
          label="Deadline"
          value={
            job.deadline
              ? new Date(job.deadline).toLocaleDateString()
              : 'None'
          }
          isLast
        />
      </Section>

      {/* Criteria */}
      {job.criteria?.length > 0 && (
        <Section header="Success Criteria">
          {job.criteria.map((c: any, i: number) => (
            <SectionRow
              key={i}
              label={c.description}
              icon={
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.systemGreen}
                />
              }
              isLast={i === job.criteria.length - 1}
            />
          ))}
        </Section>
      )}

      {/* Bids */}
      {job.status === 'OPEN' && (
        <Section header={`Bids (${job.bids?.length || 0})`}>
          {(job.bids || []).length > 0 ? (
            <View style={{ padding: spacing.cellHorizontal }}>
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
            </View>
          ) : (
            <SectionRow
              label="No bids yet"
              detail="Agents will bid soon"
              isLast
            />
          )}
        </Section>
      )}

      {/* Delivery */}
      {(job.status === 'DELIVERED' || job.status === 'VALIDATING') && job.delivery && (
        <Section header="Delivery">
          <SectionRow
            label="Proof Hash"
            detail={job.delivery.proofHash}
          />
          {job.delivery.evidenceUri && (
            <SectionRow
              label="Evidence"
              detail={job.delivery.evidenceUri}
              accessory="disclosure"
              onPress={() => {
                const uri = job.delivery.evidenceUri;
                const url = uri.startsWith('ipfs://')
                  ? uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
                  : uri;
                Linking.openURL(url);
              }}
            />
          )}
          <SectionRow
            label="Validation"
            value={job.delivery.validationStatus || 'Pending'}
            isLast
          />
        </Section>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {(job.status === 'DELIVERED' || job.status === 'VALIDATING') && (
          <>
            <Button
              title="Approve Delivery"
              variant="filled"
              color={colors.systemGreen}
              onPress={() => {}}
            />
            <View style={{ height: 10 }} />
            <Button
              title="Override Validation"
              variant="tinted"
              color={colors.systemOrange}
              onPress={() => {}}
            />
          </>
        )}

        {job.status !== 'OPEN' && job.status !== 'COMPLETED' && (
          <>
            <View style={{ height: 10 }} />
            <Button
              title="Chat with Agent"
              variant="filled"
              onPress={() => router.push(`/chat/${id}`)}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
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
  stepLine: {
    position: 'absolute',
    top: 8,
    left: '60%',
    right: '-40%',
    height: 2,
    zIndex: -1,
  },
  actions: {
    marginHorizontal: 16,
    marginTop: 16,
  },
});
