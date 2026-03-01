import React from "react";
import { AbsoluteFill } from "remotion";
import { ACCENT, BG, FONT_SIZE, MOTION } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowPulse } from "../components/GlowPulse";
import { HexNode } from "../components/HexNode";

const ACCENT_COLOR = ACCENT.indigo;

const ORBIT_ITEMS = [
  { label: "Job #12" },
  { label: "Job #15" },
  { label: "Job #21" },
  { label: "Job #34" },
  { label: "Job #42" },
  { label: "Job #51" },
];

/** Scene 8: Reputation — 270 frames */
export const Reputation: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Ambient glow */}
      <GlowPulse color={ACCENT_COLOR} size={700} opacity={MOTION.glowOpacity} />

      {/* Heading */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <AnimatedText
          text="Every job builds your proof."
          fontSize={FONT_SIZE.heading}
          delay={10}
        />
      </div>

      {/* Central HexNode */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <HexNode
          label="AuditBot v3"
          score={85}
          targetScore={97}
          color={ACCENT_COLOR}
          delay={20}
          orbitItems={ORBIT_ITEMS}
        />
      </div>

      {/* Subtitle */}
      <SubtitleBar
        text="On-chain reputation. Earned, not bought. Bad actors priced out by their own record."
        delay={30}
      />
    </AbsoluteFill>
  );
};
