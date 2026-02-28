import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { useNotifications, NotificationType } from '../../src/contexts/NotificationContext';
import { Section } from '../../src/components/ios/Section';
import { SectionRow } from '../../src/components/ios/SectionRow';
import { Button } from '../../src/components/ios/Button';

function getIconForType(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'success': return 'checkmark-circle';
    case 'warning': return 'warning';
    case 'error': return 'close-circle';
    default: return 'information-circle';
  }
}

function getColorForType(type: NotificationType, colors: any): string {
  switch (type) {
    case 'success': return colors.systemGreen;
    case 'warning': return colors.systemOrange;
    case 'error': return colors.systemRed;
    default: return colors.systemBlue;
  }
}

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString();
}

function groupByDate(notifications: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const notif of notifications) {
    const date = new Date(notif.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(notif);
  }
  return groups;
}

export default function ActivityTab() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const { notifications, markAllRead, markRead } = useNotifications();

  if (notifications.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.systemGroupedBackground }]}>
        <Ionicons name="notifications-off-outline" size={48} color={colors.tertiaryLabel} />
        <Text style={[typography.title3, { color: colors.label, marginTop: 16 }]}>
          No activity yet
        </Text>
        <Text style={[typography.subheadline, { color: colors.secondaryLabel, marginTop: 4 }]}>
          Notifications about your jobs will appear here
        </Text>
      </View>
    );
  }

  const groups = groupByDate(notifications);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.markAllContainer}>
        <Button
          title="Mark All Read"
          variant="tinted"
          onPress={markAllRead}
          style={styles.markAllBtn}
        />
      </View>

      {Object.entries(groups).map(([date, items]) => (
        <Section key={date} header={date}>
          {items.map((notif, index) => (
            <SectionRow
              key={notif.id}
              label={notif.title}
              detail={notif.body}
              value={formatTimestamp(notif.timestamp)}
              icon={
                <Ionicons
                  name={getIconForType(notif.type)}
                  size={22}
                  color={getColorForType(notif.type, colors)}
                />
              }
              accessory={notif.jobId ? 'disclosure' : 'none'}
              isLast={index === items.length - 1}
              onPress={() => {
                markRead(notif.id);
                if (notif.jobId) {
                  router.push(`/job/${notif.jobId}`);
                }
              }}
            />
          ))}
        </Section>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllContainer: {
    alignItems: 'flex-end',
    marginHorizontal: 16,
    marginTop: 16,
  },
  markAllBtn: {
    width: 160,
    height: 36,
  },
});
