import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { ACCENT, BG, FONT, FONT_SIZE, SPRING_GENTLE, SPRING_SNAPPY, MOTION } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowOrb } from "../components/GlowOrb";

/** Starting positions for 8 orbs before they converge */
const SCATTER: [number, number][] = [
  [-400, -260],
  [380, -220],
  [-260, 220],
  [320, 250],
  [-460, 30],
  [430, -50],
  [0, -340],
  [0, 310],
];

/** Scene 3 — 300 frames — The big reveal: SWARMS */
export const EnterSwarms: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Orbs rush inward over first ~60 frames
  const converge = spring({
    fps,
    frame: frame - 10,
    config: SPRING_SNAPPY,
  });

  // Central orb scale-up after convergence
  const centralScale = spring({
    fps,
    frame: frame - 50,
    config: SPRING_GENTLE,
  });

  // SWARMS wordmark
  const wordmarkEntry = spring({
    fps,
    frame: frame - 80,
    config: SPRING_GENTLE,
  });

  // Orbital ring rotation (continuous)
  const rotation1 = interpolate(frame, [0, 300], [0, 360]);
  const rotation2 = interpolate(frame, [0, 300], [360, 0]);

  // Ring opacity fades in
  const ringOpacity = spring({
    fps,
    frame: frame - 90,
    config: SPRING_GENTLE,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Converging small orbs (fade out as they merge) */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {SCATTER.map(([sx, sy], i) => {
          const x = sx * (1 - converge);
          const y = sy * (1 - converge);
          const orbOpacity = interpolate(converge, [0.7, 1], [0.12, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${ACCENT.blue} 0%, transparent 70%)`,
                opacity: orbOpacity,
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Central blue GlowOrb */}
      <GlowOrb
        color={ACCENT.blue}
        size={400}
        opacity={0.12 * centralScale}
        delay={50}
      />

      {/* Orbital rings */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <svg
          width={700}
          height={700}
          viewBox="-350 -350 700 700"
          style={{
            position: "absolute",
            opacity: ringOpacity * 0.3,
          }}
        >
          {/* Ring 1 */}
          <ellipse
            cx={0}
            cy={0}
            rx={260}
            ry={100}
            fill="none"
            stroke={ACCENT.blue}
            strokeWidth={1.2}
            transform={`rotate(${rotation1})`}
          />
          {/* Ring 2 */}
          <ellipse
            cx={0}
            cy={0}
            rx={280}
            ry={110}
            fill="none"
            stroke={ACCENT.blue}
            strokeWidth={1}
            transform={`rotate(${rotation2 + 60})`}
          />
        </svg>
      </AbsoluteFill>

      {/* SWARMS wordmark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          textAlign: "center",
        }}
      >
        <AnimatedText
          text="SWARMS"
          fontSize={FONT_SIZE.hero}
          color={ACCENT.blue}
          delay={80}
          style={{ letterSpacing: 12 }}
        />
      </div>

      {/* Subtitle */}
      <SubtitleBar
        text="The marketplace where AI agents work for hire."
        delay={120}
      />
    </AbsoluteFill>
  );
};
