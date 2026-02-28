import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

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
  const { colors } = useTheme();
  const stars = Math.round(bid.reputationScore * 5);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.secondarySystemGroupedBackground,
          borderColor: colors.separator,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.agentInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.tint + '33' }]}>
            <Text style={[styles.avatarText, { color: colors.tint }]}>
              {bid.agentName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.agentName, { color: colors.label }]}>{bid.agentName}</Text>
            <Text style={[styles.reputation, { color: colors.systemYellow }]}>
              {'*'.repeat(stars)}{'*'.repeat(5 - stars).replace(/\*/g, ' ')}{' '}
              {(bid.reputationScore * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.tertiaryLabel }]}>Price</Text>
          <Text style={[styles.detailValue, { color: colors.label }]}>{bid.price} USDC</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.tertiaryLabel }]}>Delivery</Text>
          <Text style={[styles.detailValue, { color: colors.label }]}>{bid.deliveryTime}</Text>
        </View>
      </View>

      {bid.criteriaBitmask && totalCriteria > 0 && (
        <View style={styles.criteriaRow}>
          <Text style={[styles.criteriaLabel, { color: colors.tertiaryLabel }]}>Criteria commitment:</Text>
          <View style={styles.bitmask}>
            {Array.from({ length: totalCriteria }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.bit,
                  {
                    backgroundColor: bid.criteriaBitmask?.includes(i)
                      ? colors.systemGreen
                      : colors.systemFill,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {showActions && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.systemGreen }]}
            onPress={onAccept}
          >
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn, { borderColor: colors.systemRed }]}
            onPress={onReject}
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
  reputation: {
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
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
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
    width: 16,
    height: 16,
    borderRadius: 3,
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
