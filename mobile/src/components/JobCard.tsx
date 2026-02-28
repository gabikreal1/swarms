import React from 'react';
import { View, Text, TouchableHighlight, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface JobCardProps {
  job: {
    id: number;
    title: string;
    status: string;
    budget: string;
    deadline: string;
    bidCount: number;
    category?: string;
    tags?: string[];
  };
  onPress: () => void;
}

const STATUS_COLOR_KEY: Record<string, string> = {
  OPEN: 'systemBlue',
  IN_PROGRESS: 'systemYellow',
  DELIVERED: 'systemIndigo',
  VALIDATING: 'systemOrange',
  COMPLETED: 'systemGreen',
  DISPUTED: 'systemRed',
};

export default function JobCard({ job, onPress }: JobCardProps) {
  const { colors, spacing } = useTheme();

  const colorKey = STATUS_COLOR_KEY[job.status] as keyof typeof colors | undefined;
  const badgeColor = colorKey ? colors[colorKey] : colors.secondaryLabel;

  return (
    <TouchableHighlight
      style={[
        styles.card,
        {
          backgroundColor: colors.secondarySystemGroupedBackground,
          borderColor: colors.separator,
          borderRadius: spacing.cardRadius,
        },
      ]}
      onPress={onPress}
      underlayColor={colors.systemFill}
    >
      <View>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.label }]} numberOfLines={2}>
            {job.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeColor + '22', borderColor: badgeColor }]}>
            <Text style={[styles.statusText, { color: badgeColor }]}>
              {job.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.tertiaryLabel }]}>Budget</Text>
            <Text style={[styles.detailValue, { color: colors.label }]}>{job.budget} USDC</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.tertiaryLabel }]}>Deadline</Text>
            <Text style={[styles.detailValue, { color: colors.label }]}>{job.deadline}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.tertiaryLabel }]}>Bids</Text>
            <Text style={[styles.detailValue, { color: colors.label }]}>{job.bidCount}</Text>
          </View>
        </View>

        {(job.category || (job.tags && job.tags.length > 0)) && (
          <View style={styles.tagsRow}>
            {job.category && (
              <View style={[styles.categoryPill, { backgroundColor: colors.tint + '26' }]}>
                <Text style={[styles.categoryText, { color: colors.tint }]}>{job.category}</Text>
              </View>
            )}
            {job.tags?.map((tag) => (
              <View key={tag} style={[styles.tagPill, { backgroundColor: colors.systemFill }]}>
                <Text style={[styles.tagText, { color: colors.secondaryLabel }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableHighlight>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  categoryPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
  },
});
