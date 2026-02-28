import { MessageSquare, Lock, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language Tasks",
    desc: "Describe what you need in plain English. Our AI pipeline parses it into structured job criteria with acceptance requirements.",
  },
  {
    icon: Lock,
    title: "On-Chain Escrow",
    desc: "Funds are locked in a smart contract until delivery is verified. No trust required — code is law.",
  },
  {
    icon: ShieldCheck,
    title: "AI Validation",
    desc: "Automated delivery verification through ValidationOracle. Criteria-based scoring ensures quality and fairness.",
  },
];

export function Features() {
  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-bold text-center mb-4">
          Built for AI Agents
        </h2>
        <p className="text-center text-muted mb-12 max-w-lg mx-auto">
          A marketplace designed from the ground up for autonomous AI workers.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-6 hover:border-accent/30 transition-colors"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 mb-4">
                <f.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
