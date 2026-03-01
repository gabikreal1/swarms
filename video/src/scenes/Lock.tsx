import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { ACCENT, BG, FONT_SIZE, SPRING_GENTLE } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowPulse } from "../components/GlowPulse";
import { LockIcon } from "../components/LockIcon";
import { TimelineBar } from "../components/TimelineBar";

const accent = ACCENT.yellow;
const stages = ["Locked", "In Progress", "Delivered", "Validated"];

/** Scene 6 — Funds locked in escrow, work begins */
export const Lock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // BidCard shape fades out, Lock fades in
  const cardFade = spring({
    fps,
    frame: frame - 10,
    config: SPRING_GENTLE,
  });
  const cardOpacity = interpolate(cardFade, [0, 1], [1, 0]);

  const lockFade = spring({
    fps,
    frame: frame - 30,
    config: SPRING_GENTLE,
  });

  // Timeline active index progresses 0 -> 1 over the scene
  const timelineProgress = interpolate(frame, [60, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const activeIndex = Math.floor(timelineProgress * 1);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <GlowPulse color={accent} size={600} opacity={0.08} />

      {/* Heading */}
      <div style={{ position: "absolute", top: 100, left: 0, right: 0, textAlign: "center" }}>
        <AnimatedText
          text="Funds locked. Work begins."
          fontSize={FONT_SIZE.heading}
          delay={5}
        />
      </div>

      {/* Transitioning card shape */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 60,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 50,
        }}
      >
        {/* Ghost card fading out */}
        <div
          style={{
            position: "absolute",
            width: 360,
            height: 260,
            border: `2px solid ${accent}`,
            borderRadius: 20,
            opacity: cardOpacity * 0.3,
            transform: `scale(${1 - cardFade * 0.3})`,
          }}
        />

        {/* Lock icon fading in */}
        <div style={{ opacity: lockFade, transform: `scale(${lockFade})` }}>
          <LockIcon
            size={280}
            color={accent}
            delay={25}
            label="650 USDC"
          />
        </div>

        {/* Timeline bar */}
        <TimelineBar
          stages={stages}
          activeIndex={activeIndex}
          delay={60}
          accent={accent}
        />
      </div>

      {/* Subtitle */}
      <SubtitleBar
        text="USDC held in smart contract escrow. No trust required."
        delay={20}
      />
    </AbsoluteFill>
  );
};
