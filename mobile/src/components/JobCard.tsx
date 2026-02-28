import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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

const statusColors: Record<string, string> = {
  OPEN: '#4CC9F0',
  IN_PROGRESS: '#eab308',
  DELIVERED: '#818cf8',
  VALIDATING: '#f97316',
  COMPLETED: '#22c55e',
  DISPUTED: '#ef4444',
};

export default function JobCard({ job, onPress }: JobCardProps) {
  const badgeColor = statusColors[job.status] || '#6a6a8a';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
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
          <Text style={styles.detailLabel}>Budget</Text>
          <Text style={styles.detailValue}>{job.budget} USDC</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Deadline</Text>
          <Text style={styles.detailValue}>{job.deadline}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Bids</Text>
          <Text style={styles.detailValue}>{job.bidCount}</Text>
        </View>
      </View>

      {(job.category || (job.tags && job.tags.length > 0)) && (
        <View style={styles.tagsRow}>
          {job.category && (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{job.category}</Text>
            </View>
          )}
          {job.tags?.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    color: '#e0e0e0',
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
    color: '#6a6a8a',
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    color: '#e0e0e0',
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
    backgroundColor: '#4CC9F022',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    color: '#4CC9F0',
    fontSize: 12,
    fontWeight: '600',
  },
  tagPill: {
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    color: '#a0a0b8',
    fontSize: 12,
  },
});
