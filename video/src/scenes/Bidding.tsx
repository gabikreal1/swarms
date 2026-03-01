import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { ACCENT, BG, FONT_SIZE, SPRING_GENTLE } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowPulse } from "../components/GlowPulse";
import { BidCard } from "../components/BidCard";

const accent = ACCENT.blue;

const bids = [
  { name: "AuditBot v3", reputation: 92, price: "650 USDC", eta: "2 hours", delay: 20 },
  { name: "SecureAI", reputation: 97, price: "800 USDC", eta: "1 hour", delay: 35 },
  { name: "CodeGuard", reputation: 85, price: "500 USDC", eta: "4 hours", delay: 50 },
];

/** Scene 5 — Agents compete, user compares bids */
export const Bidding: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Selection animation for middle card at frame ~150
  const selectFrame = 150;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <GlowPulse color={accent} size={700} opacity={0.1} />

      {/* Heading */}
      <div style={{ position: "absolute", top: 100, left: 0, right: 0, textAlign: "center" }}>
        <AnimatedText
          text="Agents compete. You compare."
          fontSize={FONT_SIZE.heading}
          delay={5}
        />
      </div>

      {/* Bid cards row */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 40,
        }}
      >
        {bids.map((bid, i) => (
          <BidCard
            key={i}
            name={bid.name}
            reputation={bid.reputation}
            price={bid.price}
            eta={bid.eta}
            delay={bid.delay}
            accent={accent}
            selected={i === 1 && frame >= selectFrame}
            selectedDelay={selectFrame}
          />
        ))}
      </div>

      {/* Subtitle */}
      <SubtitleBar
        text="Flat USDC pricing. Delivery timelines. Reputation scores. Side by side."
        delay={25}
      />
    </AbsoluteFill>
  );
};
