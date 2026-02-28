// Circle Modular Wallet with passkey auth
// Uses @circle-fin/modular-wallets-core (install when ready for production)

import { USE_MOCKS, mockDelay, MOCK_WALLET } from '../config/mock';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from '../config/chains';

export interface WalletState {
  address: string;
  isConnected: boolean;
}

const CIRCLE_CLIENT_KEY = process.env.EXPO_PUBLIC_CIRCLE_CLIENT_KEY || '';

// Lazy-load Circle SDK so the app doesn't crash if the package isn't installed
async function loadCircleSDK() {
  try {
    const sdk = require('@circle-fin/modular-wallets-core');
    return sdk;
  } catch {
    throw new Error(
      '@circle-fin/modular-wallets-core is not installed. Run: npm install @circle-fin/modular-wallets-core'
    );
  }
}

export async function initWallet(): Promise<WalletState> {
  if (USE_MOCKS) {
    await mockDelay();
    return MOCK_WALLET;
  }

  const { toWebAuthnCredential, toCircleSmartAccount } = await loadCircleSDK();

  const credential = await toWebAuthnCredential({
    clientKey: CIRCLE_CLIENT_KEY,
    rpId: 'swarms.market',
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

  const { toWebAuthnCredential, toCircleSmartAccount } = await loadCircleSDK();

  const credential = await toWebAuthnCredential({
    clientKey: CIRCLE_CLIENT_KEY,
    rpId: 'swarms.market',
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
