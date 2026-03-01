import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { ACCENT, BG, FONT, FONT_SIZE, SPRING_GENTLE, SPRING_SNAPPY } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowPulse } from "../components/GlowPulse";
import { LockIcon } from "../components/LockIcon";
import { ChecklistItem } from "../components/ChecklistItem";
import { USDCToken } from "../components/USDCToken";

const accent = ACCENT.green;

const criteria = [
  { text: "Vulnerability scan complete", delay: 60 },
  { text: "Gas optimization verified", delay: 90 },
  { text: "Access control audit passed", delay: 120 },
  { text: "Test coverage: 94%", delay: 150 },
];

/** Scene 7 — AI validation, criteria checks, payment release */
export const Validation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Lock opens at start
  const lockOpen = frame > 20;

  // PASSED badge at frame 180
  const badgeProgress = spring({
    fps,
    frame: frame - 180,
    config: SPRING_SNAPPY,
  });

  // USDC float up at frame 210
  const usdcProgress = spring({
    fps,
    frame: frame - 210,
    config: SPRING_GENTLE,
  });
  const usdcY = interpolate(usdcProgress, [0, 1], [0, -80]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <GlowPulse color={accent} size={700} opacity={0.1} />

      {/* Heading */}
      <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center" }}>
        <AnimatedText
          text="Verified by AI. Released on proof."
          fontSize={FONT_SIZE.heading}
          delay={5}
        />
      </div>

      {/* Main content area */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 80,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 80,
        }}
      >
        {/* Left side: Lock opening */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <LockIcon
            size={220}
            color={accent}
            delay={5}
            open={lockOpen}
          />

          {/* USDC floating up */}
          <div
            style={{
              opacity: usdcProgress,
              transform: `translateY(${usdcY}px)`,
            }}
          >
            <USDCToken size={56} delay={210} label="650 USDC" />
          </div>
        </div>

        {/* Right side: Checklist + Badge */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Checklist card */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "36px 40px",
              display: "flex",
              flexDirection: "column",
              gap: 22,
              minWidth: 420,
            }}
          >
            {criteria.map((item, i) => (
              <ChecklistItem
                key={i}
                text={item.text}
                delay={item.delay}
                accent={accent}
              />
            ))}
          </div>

          {/* PASSED badge */}
          <div
            style={{
              alignSelf: "center",
              background: accent,
              borderRadius: 14,
              padding: "14px 48px",
              transform: `scale(${badgeProgress})`,
              opacity: badgeProgress,
            }}
          >
            <span
              style={{
                fontFamily: FONT.heading,
                fontSize: 36,
                fontWeight: 800,
                color: "#000",
                letterSpacing: 4,
              }}
            >
              PASSED
            </span>
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <SubtitleBar
        text="Independent validator checks every criterion. Payment auto-releases on pass."
        delay={20}
      />
    </AbsoluteFill>
  );
};
