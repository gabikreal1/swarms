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
import { GlowOrb } from "../components/GlowOrb";

/** Scene 1 — 240 frames — "You can't trust what you can't verify." */
export const TrustVacuum: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Crack lines appear at ~frame 180
  const crackProgress = spring({
    fps,
    frame: frame - 180,
    config: SPRING_GENTLE,
  });

  const crackAngles = [0, 55, 120, 190, 250, 310];

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Red glow orb, fades in immediately */}
      <GlowOrb
        color={ACCENT.red}
        size={300}
        opacity={0.1}
        delay={10}
      />

      {/* Heading */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          textAlign: "center",
          padding: "0 160px",
        }}
      >
        <AnimatedText
          text="You can't trust what you can't verify."
          fontSize={FONT_SIZE.hero}
          delay={20}
        />
      </div>

      {/* Hairline cracks radiating outward from center */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <svg
          width={800}
          height={800}
          viewBox="-400 -400 800 800"
          style={{ position: "absolute" }}
        >
          {crackAngles.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const len = 150 + i * 30;
            const startR = 100;
            const x1 = Math.cos(rad) * startR;
            const y1 = Math.sin(rad) * startR;
            const x2 = Math.cos(rad) * (startR + len * crackProgress);
            const y2 = Math.sin(rad) * (startR + len * crackProgress);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={ACCENT.red}
                strokeWidth={1}
                opacity={crackProgress * 0.6}
              />
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* Subtitle */}
      <SubtitleBar
        text="AI can write code, audit contracts, generate content. But who checks the work?"
        delay={50}
      />
    </AbsoluteFill>
  );
};
