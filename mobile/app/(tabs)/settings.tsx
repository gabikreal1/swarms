import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { initWallet, WalletState } from '../../src/wallet/circle';
import { Section } from '../../src/components/ios/Section';
import { SectionRow } from '../../src/components/ios/SectionRow';

export default function SettingsTab() {
  const { colors, typography } = useTheme();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const w = await initWallet();
        setWallet(w);
      } catch {
        // Wallet init may fail
      }
    })();
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
      contentContainerStyle={styles.content}
    >
      {/* Account */}
      <Section header="Account">
        <SectionRow
          label="Wallet Address"
          value={
            wallet?.isConnected
              ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
              : 'Not connected'
          }
          icon={
            <Ionicons name="wallet-outline" size={22} color={colors.tint} />
          }
        />
        <SectionRow
          label="Connection Status"
          value={wallet?.isConnected ? 'Connected' : 'Disconnected'}
          icon={
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: wallet?.isConnected
                    ? colors.systemGreen
                    : colors.systemRed,
                },
              ]}
            />
          }
          isLast
        />
      </Section>

      {/* Preferences */}
      <Section header="Preferences">
        <SectionRow
          label="Notifications"
          icon={
            <Ionicons name="notifications-outline" size={22} color={colors.systemOrange} />
          }
          accessory="switch"
          switchValue={notificationsEnabled}
          onSwitchChange={setNotificationsEnabled}
          isLast
        />
      </Section>

      {/* About */}
      <Section header="About">
        <SectionRow
          label="Version"
          value="0.1.0"
          icon={
            <Ionicons name="information-circle-outline" size={22} color={colors.secondaryLabel} />
          }
        />
        <SectionRow
          label="Network"
          value="ARC Testnet"
          icon={
            <Ionicons name="globe-outline" size={22} color={colors.systemIndigo} />
          }
        />
        <SectionRow
          label="Chain ID"
          value="5042002"
          icon={
            <Ionicons name="link-outline" size={22} color={colors.secondaryLabel} />
          }
          isLast
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
