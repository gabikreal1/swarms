import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

export type BidStatus = 'pending' | 'accepted' | 'rejected';

interface BidCardProps {
  bid: {
    id: number;
    agentName: string;
    agentAddress?: string;
    price: string;
    deliveryTime: string;
    reputationScore: number;
    criteriaBitmask?: number[];
    metadataDescription?: string;
    status?: BidStatus;
  };
  totalCriteria?: number;
  onAccept: () => void;
  onReject: () => void;
  showActions?: boolean;
  loading?: boolean;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDeliveryTime(raw: string): string {
  if (!raw || raw === 'N/A') return 'N/A';
  // Already human-readable
  if (/day|week|hour|month/i.test(raw)) return raw;
  // Try to parse as hours number
  const hours = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (isNaN(hours)) return raw;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  if (hours < 168) {
    const days = Math.round(hours / 24);
    return days === 1 ? '1 day' : `${days} days`;
  }
  const weeks = Math.round(hours / 168);
  return weeks === 1 ? '1 week' : `${weeks} weeks`;
}

function formatUSDC(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getReputationTier(score: number): { label: string; color: string } {
  if (score >= 0.9) return { label: 'Excellent', color: '#30D158' };
  if (score >= 0.75) return { label: 'Good', color: '#0A84FF' };
  if (score >= 0.5) return { label: 'Average', color: '#FFD60A' };
  return { label: 'New', color: '#FF9F0A' };
}

export default function BidCard({
  bid,
  totalCriteria = 0,
  onAccept,
  onReject,
  showActions = true,
  loading = false,
}: BidCardProps) {
  const { colors } = useTheme();
  const isAccepted = bid.status === 'accepted';
  const isPending = !bid.status || bid.status === 'pending';
  const reputation = getReputationTier(bid.reputationScore);
  const percentage = Math.round(bid.reputationScore * 100);

  const copyAddress = async () => {
    if (bid.agentAddress) {
      await Clipboard.setStringAsync(bid.agentAddress);
      Alert.alert('Copied', 'Address copied to clipboard');
    }
  };

  const borderColor = isAccepted
    ? colors.systemGreen + '66'
    : colors.separator;

  const bgColor = isAccepted
    ? colors.systemGreen + '0D'
    : colors.secondarySystemGroupedBackground;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bgColor, borderColor },
      ]}
    >
      {/* Accepted badge */}
      {isAccepted && (
        <View style={[styles.acceptedBadge, { backgroundColor: colors.systemGreen + '22' }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.systemGreen} />
          <Text style={[styles.acceptedText, { color: colors.systemGreen }]}>Accepted</Text>
        </View>
      )}

      {/* Header: agent info */}
      <View style={styles.header}>
        <View style={styles.agentInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.tint + '33' }]}>
            <Text style={[styles.avatarText, { color: colors.tint }]}>
              {(bid.agentName || 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.agentDetails}>
            <Text style={[styles.agentName, { color: colors.label }]}>{bid.agentName || 'Unknown Agent'}</Text>
            {bid.agentAddress && (
              <TouchableOpacity onPress={copyAddress} style={styles.addressRow}>
                <Text style={[styles.address, { color: colors.tertiaryLabel }]}>
                  {shortenAddress(bid.agentAddress)}
                </Text>
                <Ionicons name="copy-outline" size={12} color={colors.tertiaryLabel} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Reputation pill */}
        <View style={[styles.reputationPill, { backgroundColor: reputation.color + '1A' }]}>
          <View style={[styles.reputationDot, { backgroundColor: reputation.color }]} />
          <Text style={[styles.reputationText, { color: reputation.color }]}>
            {percentage}%
          </Text>
        </View>
      </View>

      {/* Price + delivery row */}
      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.tertiaryLabel }]}>Price</Text>
          <Text style={[styles.priceValue, { color: colors.label }]}>
            {formatUSDC(bid.price)}
          </Text>
          <Text style={[styles.priceSubtext, { color: colors.tertiaryLabel }]}>
            {bid.price} USDC
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.tertiaryLabel }]}>Delivery</Text>
          <Text style={[styles.detailValue, { color: colors.label }]}>
            {formatDeliveryTime(bid.deliveryTime)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.tertiaryLabel }]}>Reputation</Text>
          <Text style={[styles.detailValue, { color: reputation.color }]}>
            {reputation.label}
          </Text>
        </View>
      </View>

      {/* Metadata description */}
      {bid.metadataDescription && (
        <View style={[styles.metadataSection, { borderTopColor: colors.separator }]}>
          <Text style={[styles.metadataLabel, { color: colors.tertiaryLabel }]}>Proposal</Text>
          <Text style={[styles.metadataBody, { color: colors.secondaryLabel }]} numberOfLines={3}>
            {bid.metadataDescription}
          </Text>
        </View>
      )}

      {/* Criteria bitmask */}
      {bid.criteriaBitmask && totalCriteria > 0 && (
        <View style={styles.criteriaRow}>
          <Text style={[styles.criteriaLabel, { color: colors.tertiaryLabel }]}>
            Criteria: {bid.criteriaBitmask.length}/{totalCriteria}
          </Text>
          <View style={styles.bitmask}>
            {Array.from({ length: totalCriteria }).map((_, i) => {
              const met = bid.criteriaBitmask?.includes(i);
              return (
                <View
                  key={i}
                  style={[
                    styles.bit,
                    {
                      backgroundColor: met
                        ? colors.systemGreen
                        : colors.systemFill,
                    },
                  ]}
                >
                  {met && (
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Actions */}
      {showActions && isPending && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.systemGreen }]}
            onPress={onAccept}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.acceptBtnText}>Signing...</Text>
            ) : (
              <Text style={styles.acceptBtnText}>Accept Bid</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn, { borderColor: colors.systemRed }]}
            onPress={onReject}
            disabled={loading}
          >
            <Text style={[styles.rejectBtnText, { color: colors.systemRed }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
    gap: 4,
  },
  acceptedText: {
    fontSize: 12,
    fontWeight: '700',
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
  agentDetails: {
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  agentName: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  address: {
    fontSize: 11,
    fontFamily: 'Courier',
  },
  reputationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  reputationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reputationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  details: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  priceSubtext: {
    fontSize: 10,
    marginTop: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  metadataSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metadataLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  metadataBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  criteriaRow: {
    marginTop: 12,
  },
  criteriaLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  bitmask: {
    flexDirection: 'row',
    gap: 4,
  },
  bit: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  rejectBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
