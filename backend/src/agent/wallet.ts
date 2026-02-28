import { ethers } from 'ethers';
import { config } from '../config';

export interface AgentWallet {
  address: string;
  signer: ethers.Signer;
}

export class AgentWalletManager {
  private provider: ethers.JsonRpcProvider;
  private wallets: Map<string, ethers.Wallet> = new Map();

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  createWallet(name: string, privateKey: string): AgentWallet {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    this.wallets.set(name, wallet);
    return { address: wallet.address, signer: wallet };
  }

  getWallet(name: string): AgentWallet | undefined {
    const wallet = this.wallets.get(name);
    if (!wallet) return undefined;
    return { address: wallet.address, signer: wallet };
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  async sendTransaction(
    name: string,
    tx: ethers.TransactionRequest,
  ): Promise<ethers.TransactionReceipt | null> {
    const wallet = this.wallets.get(name);
    if (!wallet) throw new Error(`Wallet '${name}' not found`);
    const response = await wallet.sendTransaction(tx);
    return response.wait();
  }
}
