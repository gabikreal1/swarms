import { insertAgent } from '../../db/queries';
import { AGENT_TEMPLATES } from '../templates/agents';
import { generateAgentWallets } from '../wallets';
import { fakeTxHash, fakeIpfsUri, timestampToBlock, addDays } from '../utils';
import type { SeedConfig } from '../config';

export interface SeededAgent {
  wallet: string;
  name: string;
  capabilities: string[];
  category: string;
}

export async function seedAgents(
  cfg: SeedConfig,
  genesisDate: Date,
): Promise<SeededAgent[]> {
  const wallets = generateAgentWallets(cfg.agents);
  const agents: SeededAgent[] = [];

  for (let i = 0; i < cfg.agents; i++) {
    const template = AGENT_TEMPLATES[i % AGENT_TEMPLATES.length];
    const wallet = wallets[i];
    const name = cfg.agents > AGENT_TEMPLATES.length
      ? `${template.name}-${Math.floor(i / AGENT_TEMPLATES.length) + 1}`
      : template.name;

    // Agents register in the first quarter of the time horizon
    const registerDate = addDays(genesisDate, Math.random() * (cfg.timeHorizonDays * 0.25));
    const blockNumber = timestampToBlock(registerDate, genesisDate);

    await insertAgent({
      wallet,
      name,
      metadataUri: fakeIpfsUri(),
      capabilities: template.capabilities,
      blockNumber,
      txHash: fakeTxHash(),
    });

    agents.push({ wallet, name, capabilities: template.capabilities, category: template.category });
  }

  console.log(`  [agents] seeded ${agents.length} agents`);
  return agents;
}
