import React from 'react';
import { View, Text, StyleSheet, TouchableHighlight, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

type AccessoryType = 'disclosure' | 'checkmark' | 'switch' | 'badge' | 'none';

interface SectionRowProps {
  label: string;
  value?: string;
  detail?: string;
  accessory?: AccessoryType;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  badgeText?: string;
  badgeColor?: string;
  destructive?: boolean;
  icon?: React.ReactNode;
  isLast?: boolean;
  onPress?: () => void;
}

export function SectionRow({
  label,
  value,
  detail,
  accessory = 'none',
  switchValue,
  onSwitchChange,
  badgeText,
  badgeColor,
  destructive = false,
  icon,
  isLast = false,
  onPress,
}: SectionRowProps) {
  const { colors, typography, spacing } = useTheme();

  const labelColor = destructive ? colors.destructive : colors.label;

  const renderAccessory = () => {
    switch (accessory) {
      case 'disclosure':
        return (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.tertiaryLabel}
          />
        );
      case 'checkmark':
        return (
          <Ionicons
            name="checkmark"
            size={22}
            color={colors.tint}
          />
        );
      case 'switch':
        return (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: colors.systemFill, true: colors.systemGreen }}
          />
        );
      case 'badge':
        return (
          <View
            style={[
              styles.badge,
              { backgroundColor: (badgeColor || colors.tint) + '22', borderColor: badgeColor || colors.tint },
            ]}
          >
            <Text style={[styles.badgeText, { color: badgeColor || colors.tint }]}>
              {badgeText}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  const content = (
    <View style={styles.outer}>
      <View
        style={[
          styles.row,
          {
            minHeight: 44,
            paddingHorizontal: spacing.cellHorizontal,
            paddingVertical: spacing.cellVertical,
          },
        ]}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <View style={styles.labelContainer}>
          <Text style={[typography.body, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
          {detail && (
            <Text
              style={[typography.subheadline, { color: colors.secondaryLabel }]}
              numberOfLines={2}
            >
              {detail}
            </Text>
          )}
        </View>
        {value && (
          <Text
            style={[typography.body, styles.value, { color: colors.secondaryLabel }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
        {renderAccessory()}
      </View>
      {!isLast && (
        <View
          style={[
            styles.separator,
            {
              backgroundColor: colors.separator,
              marginLeft: spacing.separatorInset + (icon ? 40 : 0),
            },
          ]}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableHighlight
        onPress={onPress}
        underlayColor={colors.systemFill}
      >
        {content}
      </TouchableHighlight>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  outer: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
    width: 28,
    alignItems: 'center',
  },
  labelContainer: {
    flex: 1,
    marginRight: 8,
  },
  value: {
    marginRight: 6,
    flexShrink: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
