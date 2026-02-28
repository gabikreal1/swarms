import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface BidCardProps {
  bid: {
    id: number;
    agentName: string;
    price: string;
    deliveryTime: string;
    reputationScore: number;
    criteriaBitmask?: number[];
  };
  totalCriteria?: number;
  onAccept: () => void;
  onReject: () => void;
  showActions?: boolean;
}

export default function BidCard({
  bid,
  totalCriteria = 0,
  onAccept,
  onReject,
  showActions = true,
}: BidCardProps) {
  const stars = Math.round(bid.reputationScore * 5);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.agentInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {bid.agentName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.agentName}>{bid.agentName}</Text>
            <Text style={styles.reputation}>
              {'*'.repeat(stars)}{'*'.repeat(5 - stars).replace(/\*/g, ' ')}{' '}
              {(bid.reputationScore * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailValue}>{bid.price} USDC</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Delivery</Text>
          <Text style={styles.detailValue}>{bid.deliveryTime}</Text>
        </View>
      </View>

      {bid.criteriaBitmask && totalCriteria > 0 && (
        <View style={styles.criteriaRow}>
          <Text style={styles.criteriaLabel}>Criteria commitment:</Text>
          <View style={styles.bitmask}>
            {Array.from({ length: totalCriteria }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.bit,
                  bid.criteriaBitmask?.includes(i)
                    ? styles.bitActive
                    : styles.bitInactive,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {showActions && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.acceptBtn]}
            onPress={onAccept}
          >
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn]}
            onPress={onReject}
          >
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
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
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CC9F033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#4CC9F0',
    fontSize: 16,
    fontWeight: '700',
  },
  agentName: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '600',
  },
  reputation: {
    color: '#eab308',
    fontSize: 12,
    marginTop: 1,
  },
  details: {
    flexDirection: 'row',
    marginTop: 12,
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
    fontSize: 14,
    fontWeight: '600',
  },
  criteriaRow: {
    marginTop: 12,
  },
  criteriaLabel: {
    color: '#6a6a8a',
    fontSize: 11,
    marginBottom: 4,
  },
  bitmask: {
    flexDirection: 'row',
    gap: 4,
  },
  bit: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  bitActive: {
    backgroundColor: '#22c55e',
  },
  bitInactive: {
    backgroundColor: '#2a2a4a',
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
  acceptBtn: {
    backgroundColor: '#22c55e',
  },
  acceptBtnText: {
    color: '#0f0f23',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  rejectBtnText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 14,
  },
});
