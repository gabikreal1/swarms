import { Stack } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { NotificationBanner } from '../src/components/NotificationBanner';

export default function RootLayout() {
  const { colors } = useTheme();

  return (
    <NotificationProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.systemBackground },
          headerTintColor: colors.tint,
          headerTitleStyle: { color: colors.label },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.systemGroupedBackground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job Details' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Butler Chat' }} />
      </Stack>
      <NotificationBanner />
    </NotificationProvider>
  );
}
