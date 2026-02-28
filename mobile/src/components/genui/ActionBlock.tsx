import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface ActionItem {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'destructive' | 'outline';
  toolCall?: string;
  toolArgs?: Record<string, unknown>;
  confirmMessage?: string;
}

interface ActionBlockProps {
  actions: ActionItem[];
  layout: 'horizontal' | 'vertical';
  onAction: (actionId: string, toolCall?: string, toolArgs?: Record<string, unknown>) => void;
}

export default function ActionBlock({ actions, layout, onAction }: ActionBlockProps) {
  const { colors } = useTheme();

  const handlePress = (action: ActionItem) => {
    if (action.confirmMessage) {
      Alert.alert('Confirm', action.confirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => onAction(action.id, action.toolCall, action.toolArgs),
        },
      ]);
    } else {
      onAction(action.id, action.toolCall, action.toolArgs);
    }
  };

  const getVariantStyle = (variant: ActionItem['variant']) => {
    switch (variant) {
      case 'primary':
        return {
          bg: colors.tint,
          text: '#FFFFFF',
          border: colors.tint,
        };
      case 'secondary':
        return {
          bg: colors.systemFill,
          text: colors.label,
          border: 'transparent',
        };
      case 'destructive':
        return {
          bg: colors.destructive,
          text: '#FFFFFF',
          border: colors.destructive,
        };
      case 'outline':
        return {
          bg: 'transparent',
          text: colors.tint,
          border: colors.tint,
        };
    }
  };

  return (
    <View
      style={[
        styles.container,
        layout === 'horizontal' ? styles.horizontal : styles.vertical,
      ]}
    >
      {actions.map((action) => {
        const vs = getVariantStyle(action.variant);
        return (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.button,
              {
                backgroundColor: vs.bg,
                borderColor: vs.border,
              },
              layout === 'horizontal' && styles.buttonHorizontal,
            ]}
            activeOpacity={0.7}
            onPress={() => handlePress(action)}
          >
            <Text style={[styles.buttonText, { color: vs.text }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  horizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  vertical: {
    flexDirection: 'column',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonHorizontal: {
    flex: 1,
    minWidth: 100,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
