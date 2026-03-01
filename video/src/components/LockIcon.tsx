import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { FONT, SPRING_GENTLE } from "../theme";

interface LockIconProps {
  size?: number;
  color?: string;
  delay?: number;
  open?: boolean;
  label?: string;
  style?: React.CSSProperties;
}

/** Animated SVG lock with stroke-dasharray draw-in and optional open state */
export const LockIcon: React.FC<LockIconProps> = ({
  size = 280,
  color = "#FFD60A",
  delay = 0,
  open = false,
  label,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Draw-in animation
  const drawProgress = spring({
    fps,
    frame: frame - delay,
    config: { ...SPRING_GENTLE, stiffness: 80 },
  });

  // Shackle open animation (rises up when open=true)
  const openProgress = open
    ? spring({
        fps,
        frame: frame - delay - 30,
        config: SPRING_GENTLE,
      })
    : 0;

  // Label fade
  const labelOpacity = spring({
    fps,
    frame: frame - delay - 15,
    config: SPRING_GENTLE,
  });

  const bodyWidth = size * 0.55;
  const bodyHeight = size * 0.4;
  const bodyX = (size - bodyWidth) / 2;
  const bodyY = size * 0.45;
  const bodyPerimeter = 2 * (bodyWidth + bodyHeight);

  const shackleWidth = size * 0.35;
  const shackleHeight = size * 0.3;
  const shackleX = (size - shackleWidth) / 2;
  const shackleY = size * 0.18;
  const shacklePerimeter = shackleWidth + 2 * shackleHeight;

  const shackleRise = interpolate(openProgress, [0, 1], [0, -size * 0.15]);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Shackle (U-shape) */}
        <path
          d={`M ${shackleX} ${shackleY + shackleHeight}
              L ${shackleX} ${shackleY + 20}
              Q ${shackleX} ${shackleY} ${shackleX + 20} ${shackleY}
              L ${shackleX + shackleWidth - 20} ${shackleY}
              Q ${shackleX + shackleWidth} ${shackleY} ${shackleX + shackleWidth} ${shackleY + 20}
              L ${shackleX + shackleWidth} ${shackleY + shackleHeight}`}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.06}
          strokeLinecap="round"
          strokeDasharray={shacklePerimeter}
          strokeDashoffset={shacklePerimeter * (1 - drawProgress)}
          transform={`translate(0, ${shackleRise})`}
        />
        {/* Lock body (rounded rect) */}
        <rect
          x={bodyX}
          y={bodyY}
          width={bodyWidth}
          height={bodyHeight}
          rx={14}
          ry={14}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.04}
          strokeDasharray={bodyPerimeter}
          strokeDashoffset={bodyPerimeter * (1 - drawProgress)}
        />
        {/* Keyhole */}
        <circle
          cx={size / 2}
          cy={bodyY + bodyHeight * 0.4}
          r={size * 0.04}
          fill={color}
          opacity={drawProgress}
        />
        <rect
          x={size / 2 - size * 0.015}
          y={bodyY + bodyHeight * 0.4}
          width={size * 0.03}
          height={bodyHeight * 0.25}
          fill={color}
          opacity={drawProgress}
          rx={2}
        />
      </svg>
      {/* Label inside lock body */}
      {label && (
        <div
          style={{
            position: "absolute",
            top: bodyY + bodyHeight + 12,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT.heading,
            fontSize: size * 0.09,
            fontWeight: 700,
            color,
            opacity: labelOpacity,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
