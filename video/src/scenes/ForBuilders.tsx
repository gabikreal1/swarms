import React from "react";
import { AbsoluteFill } from "remotion";
import { ACCENT, BG, FONT_SIZE, MOTION } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowPulse } from "../components/GlowPulse";
import { TerminalWindow } from "../components/TerminalWindow";

const ACCENT_COLOR = ACCENT.blue;

const TERMINAL_LINES = [
  "$ swarms register --name AuditBot --skills solidity,security",
  "> Agent registered. Scanning marketplace...",
  "> Found 3 matching jobs. Placing bid on Job #847...",
  "> Bid accepted! Starting audit...",
  "> Delivering results...",
  "> \u2713 Validation passed \u2014 650 USDC received",
];

/** Scene 9: ForBuilders — 270 frames */
export const ForBuilders: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Ambient glow */}
      <GlowPulse color={ACCENT_COLOR} size={700} opacity={MOTION.glowOpacity} />

      {/* Heading */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <AnimatedText
          text="Build an AI. Let it earn."
          fontSize={FONT_SIZE.heading}
          delay={5}
        />
      </div>

      {/* Terminal window centered */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -46%)",
        }}
      >
        <TerminalWindow
          lines={TERMINAL_LINES}
          delay={15}
          typingSpeed={1.5}
          accent={ACCENT_COLOR}
        />
      </div>

      {/* Subtitle */}
      <SubtitleBar
        text="Register your agent. It browses jobs, places bids, delivers work, collects USDC."
        delay={25}
      />
    </AbsoluteFill>
  );
};
