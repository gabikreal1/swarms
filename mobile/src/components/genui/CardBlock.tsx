import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface CardBlockProps {
  variant: string;
  data: Record<string, unknown>;
  onAction?: (actionId: string, toolCall?: string, toolArgs?: Record<string, unknown>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#34C759',
  in_progress: '#FF9500',
  delivered: '#5856D6',
  completed: '#30D158',
  disputed: '#FF3B30',
  validating: '#FF9F0A',
};

export default function CardBlock({ variant, data, onAction }: CardBlockProps) {
  const { colors } = useTheme();

  if (variant === 'job_status') {
    return <JobStatusCard data={data} colors={colors} onAction={onAction} />;
  }

  // Fallback: render as key-value pairs
  return (
    <View style={[styles.card, { backgroundColor: colors.secondarySystemBackground }]}>
      {Object.entries(data).map(([key, value]) => (
        <View key={key} style={styles.kvRow}>
          <Text style={[styles.kvLabel, { color: colors.secondaryLabel }]}>{key}</Text>
          <Text style={[styles.kvValue, { color: colors.label }]}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

function JobStatusCard({
  data,
  colors,
  onAction,
}: {
  data: Record<string, unknown>;
  colors: ReturnType<typeof import('../../theme/colors').getColors>;
  onAction?: CardBlockProps['onAction'];
}) {
  const status = String(data.status || 'open');
  const statusColor = STATUS_COLORS[status] || colors.secondaryLabel;
  const description = String(data.description || '');
  const bidCount = Number(data.bid_count ?? data.bidCount ?? 0);
  const jobId = String(data.id || data.jobId || '');
  const chainId = data.chain_id ?? data.chainId;
  const tags = data.tags as string[] | undefined;

  return (
    <View style={[styles.card, { backgroundColor: colors.secondarySystemBackground }]}>
      {/* Header: status badge + chain ID */}
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        {chainId != null && (
          <Text style={[styles.chainId, { color: colors.tertiaryLabel }]}>
            #{String(chainId)}
          </Text>
        )}
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: colors.label }]} numberOfLines={3}>
        {description}
      </Text>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.slice(0, 4).map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.systemFill }]}>
              <Text style={[styles.tagText, { color: colors.secondaryLabel }]}>{tag}</Text>
            </View>
          ))}
          {tags.length > 4 && (
            <Text style={[styles.moreTag, { color: colors.tertiaryLabel }]}>
              +{tags.length - 4}
            </Text>
          )}
        </View>
      )}

      {/* Footer: bid count + view bids button */}
      <View style={styles.cardFooter}>
        <Text style={[styles.bidCount, { color: colors.secondaryLabel }]}>
          {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
        </Text>
        {bidCount > 0 && onAction && (
          <TouchableOpacity
            style={[styles.viewBidsBtn, { backgroundColor: colors.tint + '15', borderColor: colors.tint }]}
            activeOpacity={0.7}
            onPress={() => onAction(`view-bids-${jobId}`, 'get_job_bids', { jobId })}
          >
            <Text style={[styles.viewBidsBtnText, { color: colors.tint }]}>View Bids</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chainId: {
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 15,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  moreTag: {
    fontSize: 12,
    fontWeight: '500',
    alignSelf: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  bidCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewBidsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewBidsBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kvLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  kvValue: {
    fontSize: 13,
  },
});
