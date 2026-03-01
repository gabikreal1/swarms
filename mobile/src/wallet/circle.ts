// Local wallet — generates a keypair on-device, persisted in SecureStore.
// Works in Expo Go without native modules.

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { privateKeyToAccount } from 'viem/accounts';

async function generateKey(): Promise<`0x${string}`> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const hex = Array.from(new Uint8Array(randomBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
}

export interface WalletState {
  address: string;
  isConnected: boolean;
}

const STORAGE_KEY = 'swarms_wallet_pk';

export async function initWallet(): Promise<WalletState> {
  let pk = await SecureStore.getItemAsync(STORAGE_KEY);

  if (!pk) {
    pk = await generateKey();
    await SecureStore.setItemAsync(STORAGE_KEY, pk);
    console.log('[wallet] Generated new wallet');
  } else {
    console.log('[wallet] Loaded existing wallet');
  }

  const account = privateKeyToAccount(pk as `0x${string}`);

  return {
    address: account.address,
    isConnected: true,
  };
}

export async function getAccount() {
  const pk = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!pk) throw new Error('No wallet found. Call initWallet() first.');
  return privateKeyToAccount(pk as `0x${string}`);
}

export async function signAndSendTransaction(tx: {
  to: string;
  data: string;
  value: string;
}) {
  const account = await getAccount();

  const { createWalletClient, http } = await import('viem');
  const { arcTestnet } = await import('../config/chains');

  const client = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const hash = await client.sendTransaction({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value),
  });

  return hash;
}

export async function checkAllowance(
  owner: `0x${string}`,
  spender: `0x${string}`,
): Promise<bigint> {
  const { createPublicClient, http, erc20Abi } = await import('viem');
  const { arcTestnet, USDC_ADDRESS } = await import('../config/chains');

  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const allowance = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  });

  return allowance;
}

export async function approveUSDC(
  spender: `0x${string}`,
  amount: bigint,
): Promise<string> {
  const account = await getAccount();
  const { createWalletClient, http, encodeFunctionData, erc20Abi } = await import('viem');
  const { arcTestnet, USDC_ADDRESS } = await import('../config/chains');

  const client = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  });

  const hash = await client.sendTransaction({
    to: USDC_ADDRESS,
    data,
    value: 0n,
  });

  return hash;
}

export async function waitForReceipt(
  txHash: `0x${string}`,
  timeoutMs: number = 30000,
): Promise<{ status: 'success' | 'reverted'; transactionHash: string }> {
  const { createPublicClient, http } = await import('viem');
  const { arcTestnet } = await import('../config/chains');

  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    timeout: timeoutMs,
  });

  return {
    status: receipt.status,
    transactionHash: receipt.transactionHash,
  };
}

export async function exportPrivateKey(): Promise<string> {
  const pk = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!pk) throw new Error('No wallet found.');
  return pk;
}

export async function disconnectWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
