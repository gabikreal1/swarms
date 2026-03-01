import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface GlowPulseProps {
  color: string;
  size?: number;
  opacity?: number;
  /** Pulse speed in frames per cycle */
  period?: number;
}

/** Ambient radial glow that pulses */
export const GlowPulse: React.FC<GlowPulseProps> = ({
  color,
  size = 600,
  opacity = 0.1,
  period = 90,
}) => {
  const frame = useCurrentFrame();

  const pulse = interpolate(
    Math.sin((frame / period) * Math.PI * 2),
    [-1, 1],
    [0.85, 1],
  );

  return (
    <div
      style={{
        position: "absolute",
        width: size * pulse,
        height: size * pulse,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        opacity,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    />
  );
};
