// Circle Modular Wallet with passkey auth

import { USE_MOCKS, mockDelay, MOCK_WALLET } from '../config/mock';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from '../config/chains';
import {
  toWebAuthnCredential,
  toCircleSmartAccount,
} from '@circle-fin/modular-wallets-core';

export interface WalletState {
  address: string;
  isConnected: boolean;
}

const CIRCLE_CLIENT_KEY = process.env.EXPO_PUBLIC_CIRCLE_CLIENT_KEY || '';

// In Expo Go the bundle ID is host.exp.Exponent; in production it's swarms.market
const __DEV_MODE__ = typeof __DEV__ !== 'undefined' && __DEV__;
const RP_ID = __DEV_MODE__ ? 'localhost' : 'swarms.market';

export async function initWallet(): Promise<WalletState> {
  if (USE_MOCKS) {
    await mockDelay();
    return MOCK_WALLET;
  }

  console.log('[wallet] Initializing Circle wallet, rpId:', RP_ID);
  console.log('[wallet] Client key present:', !!CIRCLE_CLIENT_KEY);

  const credential = await toWebAuthnCredential({
    clientKey: CIRCLE_CLIENT_KEY,
    rpId: RP_ID,
  });

  const account = await toCircleSmartAccount({
    client: createPublicClient({
      chain: arcTestnet,
      transport: http(),
    }),
    credential,
  });

  return {
    address: account.address,
    isConnected: true,
  };
}

export async function createGaslessBundler() {
  if (USE_MOCKS) {
    throw new Error('Bundler not available in mock mode');
  }

  const credential = await toWebAuthnCredential({
    clientKey: CIRCLE_CLIENT_KEY,
    rpId: RP_ID,
  });

  const account = await toCircleSmartAccount({
    client: createPublicClient({
      chain: arcTestnet,
      transport: http(),
    }),
    credential,
  });

  const viemModule = await import('viem');
  const createBundlerClient = (viemModule as any).createBundlerClient;
  const bundlerClient = createBundlerClient({
    account,
    chain: arcTestnet,
    transport: http(),
    paymaster: true,
  });

  return { account, bundlerClient };
}

export async function signAndSendTransaction(tx: {
  to: string;
  data: string;
  value: string;
}) {
  if (USE_MOCKS) {
    await mockDelay();
    return '0xmock_tx_hash_' + Date.now().toString(16);
  }

  const { bundlerClient } = await createGaslessBundler();

  const hash = await bundlerClient.sendUserOperation({
    calls: [{
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value),
    }],
  });

  return hash;
}
