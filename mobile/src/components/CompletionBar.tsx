import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface CompletionBarProps {
  score: number; // 0-100
}

export default function CompletionBar({ score }: CompletionBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: score,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const getColor = () => {
    if (score < 40) return '#ef4444';
    if (score <= 70) return '#eab308';
    return '#22c55e';
  };

  const interpolatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Completeness</Text>
        <Text style={[styles.percentage, { color: getColor() }]}>{score}%</Text>
      </View>
      <View style={styles.track}>
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
    color: '#a0a0b8',
    fontSize: 13,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '700',
  },
  track: {
    height: 8,
    backgroundColor: '#2a2a4a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
