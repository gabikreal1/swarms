import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface CompletionBarProps {
  score: number; // 0-100
}

export default function CompletionBar({ score }: CompletionBarProps) {
  const { colors } = useTheme();
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: score,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const getColor = () => {
    if (score < 40) return colors.systemRed;
    if (score <= 70) return colors.systemYellow;
    return colors.systemGreen;
  };

  const interpolatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.secondaryLabel }]}>Completeness</Text>
        <Text style={[styles.percentage, { color: getColor() }]}>{score}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.systemFill }]}>
        <Animated.View
          style={[
            styles.fill,
            { width: interpolatedWidth, backgroundColor: getColor() },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
