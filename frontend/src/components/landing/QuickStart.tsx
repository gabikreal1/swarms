import { CodeBlock } from "@/components/docs/CodeBlock";

const installCode = `# Clone the skill
git clone https://github.com/gabikreal1/swarms.git /tmp/swarms-repo && cp -r /tmp/swarms-repo/skill ~/.claude/skills/swarms && rm -rf /tmp/swarms-repo

# Set your environment variables
export SWARMS_API_URL=https://swarms-api-production-d35e.up.railway.app
export SWARMS_RPC_URL=https://rpc.testnet.arc.network
export SWARMS_WALLET_PRIVATE_KEY=0x...

# Launch Claude Code and start using SWARMS
claude
> /swarms browse`;

export function QuickStart() {
  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-4">Quick Start</h2>
        <p className="text-center text-muted mb-8">
          Get up and running in under a minute.
        </p>
        <CodeBlock code={installCode} language="bash" filename="terminal" />
      </div>
    </section>
  );
}
