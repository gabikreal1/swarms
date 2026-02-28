import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { createPublicClient, http, formatUnits } from 'viem';
import { useTheme } from '../../src/theme/useTheme';
import { initWallet, disconnectWallet, WalletState } from '../../src/wallet/circle';
import { arcTestnet } from '../../src/config/chains';
import { Section } from '../../src/components/ios/Section';
import { SectionRow } from '../../src/components/ios/SectionRow';

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export default function SettingsTab() {
  const { colors, typography } = useTheme();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
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

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) return;
    try {
      const raw = await publicClient.getBalance({
        address: wallet.address as `0x${string}`,
      });
      setBalance(formatUnits(raw, 6));
    } catch {
      setBalance('—');
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet?.isConnected) fetchBalance();
  }, [wallet, fetchBalance]);

  const copyAddress = async () => {
    if (!wallet?.address) return;
    await Clipboard.setStringAsync(wallet.address);
    Alert.alert('Copied', 'Wallet address copied to clipboard');
  };

  const mintMockUSDC = async () => {
    if (!wallet?.address) return;
    setMinting(true);
    try {
      const faucetRes = await fetch(
        'https://faucet.circle.com/api/drip',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinationAddress: wallet.address,
            chain: 'ARC-TESTNET',
          }),
        },
      );
      if (faucetRes.ok) {
        Alert.alert('Minted!', 'Testnet USDC requested from Circle faucet');
        setTimeout(() => fetchBalance(), 3000);
      } else {
        Alert.alert(
          'Faucet',
          'Use the Circle faucet at faucet.circle.com to mint testnet USDC.',
        );
      }
    } catch {
      Alert.alert(
        'Faucet',
        'Could not reach faucet. Visit faucet.circle.com manually.',
      );
    } finally {
      setMinting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
      contentContainerStyle={styles.content}
    >
      {/* Wallet */}
      <Section header="Wallet">
        <SectionRow
          label="Address"
          value={
            wallet?.isConnected
              ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
              : 'Not connected'
          }
          icon={
            <Ionicons name="wallet-outline" size={22} color={colors.tint} />
          }
          accessory="disclosure"
          onPress={wallet?.isConnected ? copyAddress : undefined}
        />
        <SectionRow
          label="Balance"
          value={balance !== null ? `${balance} USDC` : 'Loading...'}
          icon={
            <Ionicons name="cash-outline" size={22} color={colors.systemGreen} />
          }
        />
        <SectionRow
          label="Copy Full Address"
          icon={
            <Ionicons name="copy-outline" size={22} color={colors.tint} />
          }
          accessory="disclosure"
          onPress={copyAddress}
        />
        <SectionRow
          label={minting ? 'Minting...' : 'Mint Testnet USDC'}
          icon={
            minting ? (
              <ActivityIndicator size="small" color={colors.systemOrange} />
            ) : (
              <Ionicons name="add-circle-outline" size={22} color={colors.systemOrange} />
            )
          }
          accessory="disclosure"
          onPress={minting ? undefined : mintMockUSDC}
        />
        <SectionRow
          label="Disconnect Wallet"
          icon={
            <Ionicons name="log-out-outline" size={22} color={colors.destructive} />
          }
          destructive
          isLast
          onPress={() => {
            Alert.alert('Disconnect', 'Remove wallet from this device?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Disconnect',
                style: 'destructive',
                onPress: async () => {
                  await disconnectWallet();
                  setWallet(null);
                  setBalance(null);
                },
              },
            ]);
          }}
        />
      </Section>

      {/* Network */}
      <Section header="Network">
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
});
