import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

interface LinkBlockProps {
  label: string;
  url: string;
  icon?: string;
}

export default function LinkBlock({ label, url, icon }: LinkBlockProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err),
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.tint + '12', borderColor: colors.tint + '30' }]}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <Ionicons
        name={(icon as any) || 'link-outline'}
        size={18}
        color={colors.tint}
      />
      <Text style={[styles.label, { color: colors.tint }]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="open-outline" size={14} color={colors.tint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
