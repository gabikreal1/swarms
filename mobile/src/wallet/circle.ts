// Circle Modular Wallet with passkey auth
// Uses @circle-fin/modular-wallets-core
import { toWebAuthnCredential, toCircleSmartAccount } from '@circle-fin/modular-wallets-core';
import { createBundlerClient, createPublicClient, http } from 'viem';
import { arcTestnet } from '../config/chains';

export interface WalletState {
  address: string;
  isConnected: boolean;
}

const CIRCLE_CLIENT_KEY = process.env.EXPO_PUBLIC_CIRCLE_CLIENT_KEY || '';

export async function initWallet(): Promise<WalletState> {
  // Create WebAuthn credential (passkey)
  const credential = await toWebAuthnCredential({
    clientKey: CIRCLE_CLIENT_KEY,
    rpId: 'swarms.market',
  });

  // Create smart account
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

  const bundlerClient = createBundlerClient({
    account,
    chain: arcTestnet,
    transport: http(),
    paymaster: true, // Enable Gas Station for gasless tx
  });

  return { account, bundlerClient };
}

export async function signAndSendTransaction(tx: {
  to: string;
  data: string;
  value: string;
}) {
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
