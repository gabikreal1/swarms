import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface SectionProps {
  header?: string;
  footer?: string;
  children: React.ReactNode;
}

export function Section({ header, footer, children }: SectionProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={styles.container}>
      {header && (
        <Text
          style={[
            typography.footnote,
            styles.header,
            {
              color: colors.secondaryLabel,
              marginTop: spacing.sectionHeaderTop,
              marginBottom: spacing.sectionHeaderBottom,
            },
          ]}
        >
          {header.toUpperCase()}
        </Text>
      )}
      <View
        style={[
          styles.body,
          {
            backgroundColor: colors.secondarySystemGroupedBackground,
            borderRadius: spacing.cardRadius,
          },
        ]}
      >
        {children}
      </View>
      {footer && (
        <Text
          style={[
            typography.footnote,
            styles.footer,
            { color: colors.secondaryLabel },
          ]}
        >
          {footer}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
  },
  header: {
    paddingHorizontal: 16,
  },
  body: {
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
});
