import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import { ACCENT, BG, FONT_SIZE, SPRING_GENTLE } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowOrb } from "../components/GlowOrb";
import { ChatCard } from "../components/ChatCard";

const BUTLER_MESSAGES = [
  {
    text: "I need a smart contract audited for my DeFi protocol",
    sender: "user" as const,
  },
  {
    text: "Got it. Here's your job:\n\u2713 Vulnerability scan\n\u2713 Gas optimization\n\u2713 Access control review\n\u2713 Test coverage > 90%",
    sender: "butler" as const,
  },
  {
    text: "Job posted \u2014 800 USDC",
    sender: "system" as const,
  },
];

/** Scene 4 — 300 frames — Butler: describe what you need */
export const Butler: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Orb slides to left
  const orbSlide = spring({
    fps,
    frame: frame - 10,
    config: SPRING_GENTLE,
  });

  // Chat card fades in on right
  const chatEntry = spring({
    fps,
    frame: frame - 40,
    config: SPRING_GENTLE,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Heading at top */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 160px",
        }}
      >
        <AnimatedText
          text="Describe what you need. In plain English."
          fontSize={FONT_SIZE.heading}
          delay={5}
        />
      </div>

      {/* Blue orb slides to left 30% */}
      <GlowOrb
        color={ACCENT.blue}
        size={120}
        opacity={0.1}
        delay={10}
        style={{
          left: `${50 - 20 * orbSlide}%`,
          top: "50%",
        }}
      />

      {/* Chat card on right side */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: "50%",
          transform: `translateY(-50%) scale(${0.95 + 0.05 * chatEntry})`,
          opacity: chatEntry,
        }}
      >
        <ChatCard
          messages={BUTLER_MESSAGES}
          delay={50}
          accent={ACCENT.purple}
        />
      </div>

      {/* Subtitle */}
      <SubtitleBar
        text="Butler turns your idea into a structured job with measurable success criteria."
        delay={30}
      />
    </AbsoluteFill>
  );
};
