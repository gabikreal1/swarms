import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';

type ButtonVariant = 'filled' | 'tinted' | 'gray';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'filled',
  color,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { colors, typography, spacing } = useTheme();

  const tint = color || colors.tint;

  const getBackgroundColor = () => {
    switch (variant) {
      case 'filled':
        return tint;
      case 'tinted':
        return tint + '26'; // 15% opacity
      case 'gray':
        return colors.systemFill;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'filled':
        return '#FFFFFF';
      case 'tinted':
        return tint;
      case 'gray':
        return colors.label;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          height: spacing.buttonHeight,
          borderRadius: spacing.cardRadius,
          opacity: disabled ? 0.3 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text
          style={[
            typography.headline,
            { color: getTextColor(), fontWeight: '700' },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
