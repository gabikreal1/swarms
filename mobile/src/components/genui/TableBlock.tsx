import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  flex?: number;
}

interface TableBlockProps {
  columns: TableColumn[];
  rows: Record<string, string | number>[];
}

export default function TableBlock({ columns, rows }: TableBlockProps) {
  const { colors } = useTheme();

  const getTextAlign = (align?: string) => {
    if (align === 'center') return 'center' as const;
    if (align === 'right') return 'right' as const;
    return 'left' as const;
  };

  return (
    <View style={styles.table}>
      {/* Header */}
      <View
        style={[
          styles.headerRow,
          { borderBottomColor: colors.separator },
        ]}
      >
        {(columns || []).map((col) => (
          <View key={col.key} style={[styles.cell, { flex: col.flex ?? 1 }]}>
            <Text
              style={[
                styles.headerText,
                {
                  color: colors.secondaryLabel,
                  textAlign: getTextAlign(col.align),
                },
              ]}
            >
              {col.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Rows */}
      {(rows || []).map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={[
            styles.dataRow,
            {
              backgroundColor:
                rowIndex % 2 === 1
                  ? colors.tertiarySystemBackground
                  : 'transparent',
              borderBottomColor: colors.separator,
            },
          ]}
        >
          {(columns || []).map((col) => (
            <View key={col.key} style={[styles.cell, { flex: col.flex ?? 1 }]}>
              <Text
                style={[
                  styles.cellText,
                  {
                    color: colors.label,
                    textAlign: getTextAlign(col.align),
                  },
                ]}
                numberOfLines={2}
              >
                {String(row[col.key] ?? '')}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 2,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  cell: {
    paddingHorizontal: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cellText: {
    fontSize: 14,
  },
});
