import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { encodeFunctionData } from 'viem';
import { useTheme } from '../../src/theme/useTheme';
import { api } from '../../src/api/client';
import { CONTRACTS } from '../../src/config/chains';
import { initWallet, signAndSendTransaction, waitForReceipt } from '../../src/wallet/circle';
import { useNotifications } from '../../src/contexts/NotificationContext';
import { Section } from '../../src/components/ios/Section';
import { SectionRow } from '../../src/components/ios/SectionRow';
import { Button } from '../../src/components/ios/Button';
import BidCard from '../../src/components/BidCard';
import { STATUS_STEPS, normalizeStatus, statusLabel, getStatusColor } from '../../src/utils/status';
import { formatDeadline } from '../../src/utils/deadline';

// Minimal ABI for OrderBook contract actions
const ORDER_BOOK_ABI = [
  {
    name: 'acceptBid',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'bidId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'approveDelivery',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const statusColorMap: Record<string, string> = {};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { showNotification } = useNotifications();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [txLoading, setTxLoading] = useState<string | null>(null); // bid id or 'approve'
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build color map from theme
  const colorMap: Record<string, string> = {
    open: colors.systemBlue,
    in_progress: colors.systemYellow,
    delivered: colors.systemIndigo,
    validating: colors.systemOrange,
    completed: colors.systemGreen,
    disputed: colors.systemRed,
  };

  // Init wallet to check if user is the poster
  useEffect(() => {
    (async () => {
      try {
        const w = await initWallet();
        setWalletAddress(w.address);
      } catch {
        // wallet not available
      }
    })();
  }, []);

  const fetchJob = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Auto-refresh every 30s for open/in_progress jobs
  useEffect(() => {
    const s = normalizeStatus(job?.status);
    if (s === 'open' || s === 'in_progress') {
      autoRefreshTimer.current = setInterval(() => {
        fetchJob();
      }, 30000);
    }
    return () => {
      if (autoRefreshTimer.current) {
        clearInterval(autoRefreshTimer.current);
        autoRefreshTimer.current = null;
      }
    };
  }, [job?.status, fetchJob]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJob();
    setRefreshing(false);
  };

  const isJobPoster = walletAddress && job?.poster &&
    walletAddress.toLowerCase() === job.poster.toLowerCase();

  const handleAcceptBid = (bid: any) => {
    const price = bid.price || bid.amount || '0';
    const name = bid.agentName || bid.agent_address?.slice(0, 10) || 'Agent';

    Alert.alert(
      'Accept Bid',
      `Accept bid from ${name} for ${price} USDC?\n\nThis will lock the funds in escrow and assign the job to this agent.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setTxLoading(String(bid.id));
            try {
              const data = encodeFunctionData({
                abi: ORDER_BOOK_ABI,
                functionName: 'acceptBid',
                args: [BigInt(id!), BigInt(bid.id)],
              });

              const txHash = await signAndSendTransaction({
                to: CONTRACTS.OrderBook,
                data,
                value: '0',
              });

              showNotification({
                type: 'info',
                title: 'Transaction Sent',
                body: `Accepting bid from ${name}...`,
                jobId: id,
              });

              const receipt = await waitForReceipt(txHash as `0x${string}`);

              if (receipt.status === 'success') {
                showNotification({
                  type: 'success',
                  title: 'Bid Accepted',
                  body: `${name}'s bid on your job has been accepted`,
                  jobId: id,
                });
                Alert.alert('Success', `Bid accepted! Transaction: ${txHash.slice(0, 10)}...`);
                await fetchJob();
              } else {
                Alert.alert('Failed', 'Transaction reverted. Please try again.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to accept bid');
            }
            setTxLoading(null);
          },
        },
      ],
    );
  };

  const handleRejectBid = (bidId: number) => {
    Alert.alert('Reject Bid', 'Are you sure you want to reject this bid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          // Rejection is local-only for now (no on-chain action)
          showNotification({
            type: 'info',
            title: 'Bid Rejected',
            body: 'The bid has been dismissed',
            jobId: id,
          });
        },
      },
    ]);
  };

  const handleApproveDelivery = () => {
    Alert.alert(
      'Approve Delivery',
      'Are you sure you want to approve this delivery? This will release the escrowed funds to the agent.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setTxLoading('approve');
            try {
              const data = encodeFunctionData({
                abi: ORDER_BOOK_ABI,
                functionName: 'approveDelivery',
                args: [BigInt(id!)],
              });

              const txHash = await signAndSendTransaction({
                to: CONTRACTS.OrderBook,
                data,
                value: '0',
              });

              showNotification({
                type: 'info',
                title: 'Transaction Sent',
                body: 'Approving delivery...',
                jobId: id,
              });

              const receipt = await waitForReceipt(txHash as `0x${string}`);

              if (receipt.status === 'success') {
                showNotification({
                  type: 'success',
                  title: 'Delivery Approved',
                  body: 'Funds have been released to the agent',
                  jobId: id,
                });
                Alert.alert('Success', `Delivery approved! Transaction: ${txHash.slice(0, 10)}...`);
                await fetchJob();
              } else {
                Alert.alert('Failed', 'Transaction reverted. Please try again.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to approve delivery');
            }
            setTxLoading(null);
          },
        },
      ],
    );
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

  const jobStatus = normalizeStatus(job.status);
  const currentStepIdx = STATUS_STEPS.indexOf(jobStatus);
  const bidCount = job.bids?.length || job.bidCount || 0;

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
      {/* Status Timeline */}
      <View style={styles.timeline}>
        {STATUS_STEPS.map((step, i) => {
          const isActive = i <= currentStepIdx;
          const isCurrent = i === currentStepIdx;
          const color = isActive
            ? colorMap[step] || colors.tint
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
                {statusLabel(step)}
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
          value={formatDeadline(job.deadline)}
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
      {(jobStatus === 'open' || bidCount > 0) && (
        <Section header={`Bids (${bidCount})`}>
          {(job.bids || []).length > 0 ? (
            <View style={{ padding: spacing.cellHorizontal }}>
              {(job.bids || []).map((bid: any) => (
                <BidCard
                  key={bid.id}
                  bid={{
                    id: bid.id,
                    agentName: bid.agentName || bid.agent_address?.slice(0, 10) || 'Agent',
                    agentAddress: bid.agent_address || bid.agentAddress,
                    price: bid.price || bid.amount || '0',
                    deliveryTime: bid.deliveryTime || bid.delivery_time || 'N/A',
                    reputationScore: bid.reputationScore || bid.reputation || 0,
                    criteriaBitmask: bid.criteriaBitmask,
                    metadataDescription: bid.metadataDescription || bid.description,
                    status: bid.status || (jobStatus !== 'open' ? 'accepted' : 'pending'),
                  }}
                  totalCriteria={job.criteria?.length || 0}
                  onAccept={() => handleAcceptBid(bid)}
                  onReject={() => handleRejectBid(bid.id)}
                  showActions={jobStatus === 'open' && !!isJobPoster}
                  loading={txLoading === String(bid.id)}
                />
              ))}
            </View>
          ) : (
            <SectionRow
              label="No bids yet"
              detail="AI agents will bid automatically"
              isLast
            />
          )}
        </Section>
      )}

      {/* Delivery */}
      {(jobStatus === 'delivered' || jobStatus === 'validating') && job.delivery && (
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
        {(jobStatus === 'delivered' || jobStatus === 'validating') && (
          <>
            <Button
              title="Approve Delivery"
              variant="filled"
              color={colors.systemGreen}
              onPress={handleApproveDelivery}
              loading={txLoading === 'approve'}
              disabled={txLoading === 'approve'}
            />
            <View style={{ height: 10 }} />
            <Button
              title="Override Validation"
              variant="tinted"
              color={colors.systemOrange}
              onPress={() => {
                Alert.alert(
                  'Override Validation',
                  'This will manually override the automated validation result. Are you sure?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Override', style: 'destructive', onPress: () => {} },
                  ],
                );
              }}
            />
          </>
        )}

        {jobStatus !== 'completed' && (
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
