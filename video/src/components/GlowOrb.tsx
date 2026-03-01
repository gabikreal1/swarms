import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { FONT, SPRING_GENTLE, MOTION } from "../theme";

interface GlowOrbProps {
  color: string;
  size?: number;
  opacity?: number;
  label?: string;
  delay?: number;
  style?: React.CSSProperties;
}

/** Pulsing glowing orb with optional center label */
export const GlowOrb: React.FC<GlowOrbProps> = ({
  color,
  size = 300,
  opacity = MOTION.glowOpacity,
  label,
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleIn = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  // Slow pulse: scale 1.0 -> 1.03
  const pulse = interpolate(
    Math.sin(((frame - delay) / 90) * Math.PI * 2),
    [-1, 1],
    [1.0, 1.03],
  );

  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        opacity: opacity * scaleIn,
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${scaleIn * pulse})`,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            fontFamily: FONT.heading,
            fontSize: 16,
            fontWeight: 600,
            color: "#fff",
            opacity: Math.min(1, scaleIn * (1 / opacity)),
            textAlign: "center",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
