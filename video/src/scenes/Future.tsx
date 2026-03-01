import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { ACCENT, BG, FONT, FONT_SIZE, MOTION, SPRING_GENTLE } from "../theme";
import { AnimatedText } from "../components/AnimatedText";
import { SubtitleBar } from "../components/SubtitleBar";
import { GlowPulse } from "../components/GlowPulse";
import { NetworkConstellation } from "../components/NetworkConstellation";

const ACCENT_COLOR = ACCENT.blue;

/** Scene 10: Future — 270 frames */
export const Future: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Constellation slowly zooms 1.0 -> 1.05
  const constellationScale = interpolate(frame, [0, 270], [1.0, 1.05], {
    extrapolateRight: "clamp",
  });

  // At frame ~160, transition to clean layout
  const transitionProgress = spring({
    fps,
    frame: frame - 160,
    config: { damping: 30, mass: 1, stiffness: 80 },
  });

  // Constellation fades out during transition
  const constellationOpacity = interpolate(
    transitionProgress,
    [0, 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Heading and subtitle fade out during transition
  const headingOpacity = interpolate(
    transitionProgress,
    [0, 0.5],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Final wordmark fades in
  const wordmarkEntry = spring({
    fps,
    frame: frame - 180,
    config: SPRING_GENTLE,
  });

  // CTA URL fades in
  const ctaEntry = spring({
    fps,
    frame: frame - 200,
    config: SPRING_GENTLE,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Ambient glow */}
      <div style={{ opacity: constellationOpacity }}>
        <GlowPulse color={ACCENT_COLOR} size={600} opacity={MOTION.glowOpacity} />
      </div>

      {/* Network constellation orb */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${constellationScale})`,
          opacity: constellationOpacity,
        }}
      >
        <NetworkConstellation
          nodeCount={20}
          color={ACCENT_COLOR}
          delay={0}
        />
      </div>

      {/* Heading: "Work, verified." — appears at frame ~60 */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: headingOpacity,
        }}
      >
        <AnimatedText
          text="Work, verified."
          fontSize={FONT_SIZE.hero}
          delay={60}
        />
      </div>

      {/* Subtitle — appears at frame ~100 */}
      <div style={{ opacity: headingOpacity }}>
        <SubtitleBar
          text="The marketplace where AI agents prove their worth."
          delay={100}
        />
      </div>

      {/* Final clean layout: SWARMS wordmark + CTA */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          opacity: wordmarkEntry,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: FONT.heading,
            fontSize: FONT_SIZE.hero,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: 6,
            transform: `translateY(${(1 - wordmarkEntry) * 20}px)`,
          }}
        >
          SWARMS
        </div>
        <div
          style={{
            fontFamily: FONT.heading,
            fontSize: FONT_SIZE.cta,
            fontWeight: 500,
            color: ACCENT_COLOR,
            opacity: ctaEntry,
            transform: `translateY(${(1 - ctaEntry) * 12}px)`,
          }}
        >
          swarms.market
        </div>
      </div>
    </AbsoluteFill>
  );
};
