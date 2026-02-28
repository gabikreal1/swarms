import React, { useEffect, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { useNotifications, NotificationType } from '../contexts/NotificationContext';

const BANNER_HEIGHT = 90;
const AUTO_DISMISS_MS = 4000;

function getIconForType(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'success': return 'checkmark-circle-outline';
    case 'warning': return 'warning-outline';
    case 'error': return 'close-circle-outline';
    default: return 'information-circle-outline';
  }
}

export function NotificationBanner() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pendingBanner, clearPendingBanner, markRead } = useNotifications();

  const translateY = useRef(new Animated.Value(-(BANNER_HEIGHT + insets.top + 20))).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -(BANNER_HEIGHT + insets.top + 20),
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      clearPendingBanner();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy < -5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (pendingBanner) {
      // Show banner
      translateY.setValue(-(BANNER_HEIGHT + insets.top + 20));
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss
      dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [pendingBanner]);

  if (!pendingBanner) return null;

  const tintColor = (() => {
    switch (pendingBanner.type) {
      case 'success': return colors.systemGreen;
      case 'warning': return colors.systemOrange;
      case 'error': return colors.systemRed;
      default: return colors.systemBlue;
    }
  })();

  const handleTap = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    markRead(pendingBanner.id);
    if (pendingBanner.jobId) {
      router.push(`/job/${pendingBanner.jobId}`);
    }
    dismiss();
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: colors.secondarySystemBackground,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleTap}
        style={styles.content}
      >
        <Ionicons
          name={getIconForType(pendingBanner.type)}
          size={24}
          color={tintColor}
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text
            style={[typography.headline, { color: colors.label }]}
            numberOfLines={1}
          >
            {pendingBanner.title}
          </Text>
          <Text
            style={[typography.subheadline, { color: colors.secondaryLabel }]}
            numberOfLines={2}
          >
            {pendingBanner.body}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderRadius: 14,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: BANNER_HEIGHT,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
});
