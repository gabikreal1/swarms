import { ethers } from 'ethers';
import { SEED_MNEMONIC } from './config';

/**
 * Generate deterministic wallet addresses from the test mnemonic.
 * Agents use path m/44'/60'/0'/0/i
 * Posters use path m/44'/60'/0'/1/i
 */

export function generateAgentWallets(count: number): string[] {
  const wallets: string[] = [];
  for (let i = 0; i < count; i++) {
    const path = `m/44'/60'/0'/0/${i}`;
    const w = ethers.HDNodeWallet.fromPhrase(SEED_MNEMONIC, undefined, path);
    wallets.push(w.address);
  }
  return wallets;
}

export function generatePosterWallets(count: number): string[] {
  const wallets: string[] = [];
  for (let i = 0; i < count; i++) {
    const path = `m/44'/60'/0'/1/${i}`;
    const w = ethers.HDNodeWallet.fromPhrase(SEED_MNEMONIC, undefined, path);
    wallets.push(w.address);
  }
  return wallets;
}
