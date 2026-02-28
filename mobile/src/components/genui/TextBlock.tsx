import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface TextBlockProps {
  content: string;
}

function parseLine(line: string, colors: any, key: number) {
  // Parse inline bold **text**
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    parts.push(
      <Text key={`b-${key}-${match.index}`} style={{ fontWeight: '700' }}>
        {match[1]}
      </Text>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  if (parts.length === 0) parts.push(line);

  return parts;
}

export default function TextBlock({ content }: TextBlockProps) {
  const { colors, typography } = useTheme();

  const lines = content.split('\n');

  return (
    <View style={styles.container}>
      {lines.map((line, i) => {
        const trimmed = line.trimStart();

        // Bullet list items: lines starting with - or *
        if (/^[-*]\s/.test(trimmed)) {
          const bulletText = trimmed.replace(/^[-*]\s/, '');
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: colors.tint }]}>{'\u2022'}</Text>
              <Text style={[typography.body, { color: colors.label, flex: 1 }]}>
                {parseLine(bulletText, colors, i)}
              </Text>
            </View>
          );
        }

        // Numbered list items
        const numMatch = trimmed.match(/^(\d+)\.\s/);
        if (numMatch) {
          const numText = trimmed.replace(/^\d+\.\s/, '');
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.numBullet, { color: colors.secondaryLabel }]}>
                {numMatch[1]}.
              </Text>
              <Text style={[typography.body, { color: colors.label, flex: 1 }]}>
                {parseLine(numText, colors, i)}
              </Text>
            </View>
          );
        }

        // Empty line = spacer
        if (trimmed === '') {
          return <View key={i} style={styles.spacer} />;
        }

        // Regular text
        return (
          <Text key={i} style={[typography.body, { color: colors.label }]}>
            {parseLine(line, colors, i)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
    gap: 8,
  },
  bullet: {
    fontSize: 16,
    lineHeight: 22,
  },
  numBullet: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    minWidth: 20,
  },
  spacer: {
    height: 8,
  },
});
