import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { ACCENT, BG, FONT_SIZE, SPRING_GENTLE, SPRING_SNAPPY } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowOrb } from "../components/GlowOrb";

const PLATFORMS = [
  "GPT",
  "Claude",
  "Gemini",
  "Llama",
  "Mistral",
  "Copilot",
  "Midjourney",
  "Stable",
];

/** Target positions for scattered orbs (relative to center, in px) */
const POSITIONS: [number, number][] = [
  [-320, -200],
  [300, -180],
  [-200, 180],
  [280, 200],
  [-400, 20],
  [380, -30],
  [0, -280],
  [0, 260],
];

/** Scene 2 — 240 frames — Discovery Problem */
export const DiscoveryProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dashed containment circle draws at ~frame 140
  const circleProgress = spring({
    fps,
    frame: frame - 140,
    config: SPRING_GENTLE,
  });

  const circleRadius = 420;
  const circumference = 2 * Math.PI * circleRadius;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Heading at top */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 120px",
        }}
      >
        <AnimatedText
          text="Dozens of platforms. No single source of truth."
          fontSize={FONT_SIZE.heading}
          delay={10}
        />
      </div>

      {/* Scattered orbs */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {PLATFORMS.map((name, i) => {
          const scatterDelay = 20 + i * 6;
          const scatter = spring({
            fps,
            frame: frame - scatterDelay,
            config: SPRING_SNAPPY,
          });

          const [tx, ty] = POSITIONS[i];

          return (
            <GlowOrb
              key={name}
              color={ACCENT.orange}
              size={80}
              opacity={0.12}
              label={name}
              delay={scatterDelay}
              style={{
                left: `calc(50% + ${tx * scatter}px)`,
                top: `calc(50% + ${ty * scatter}px)`,
              }}
            />
          );
        })}

        {/* Dashed containment circle */}
        <svg
          width={circleRadius * 2 + 40}
          height={circleRadius * 2 + 40}
          viewBox={`${-(circleRadius + 20)} ${-(circleRadius + 20)} ${circleRadius * 2 + 40} ${circleRadius * 2 + 40}`}
          style={{ position: "absolute", pointerEvents: "none" }}
        >
          <circle
            cx={0}
            cy={0}
            r={circleRadius}
            fill="none"
            stroke={ACCENT.orange}
            strokeWidth={1.5}
            strokeDasharray="12 8"
            strokeDashoffset={circumference * (1 - circleProgress)}
            opacity={circleProgress * 0.5}
          />
        </svg>
      </AbsoluteFill>

      {/* Subtitle */}
      <SubtitleBar
        text="Finding the right AI for a specific task means searching everywhere."
        delay={40}
      />
    </AbsoluteFill>
  );
};
