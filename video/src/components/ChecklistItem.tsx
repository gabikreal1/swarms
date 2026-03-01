import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FONT, FONT_SIZE, SPRING_GENTLE } from "../theme";

interface ChecklistItemProps {
  text: string;
  delay?: number;
  accent?: string;
  style?: React.CSSProperties;
}

/** Animated checkmark + text for validation scenes */
export const ChecklistItem: React.FC<ChecklistItemProps> = ({
  text,
  delay = 0,
  accent = "#30D158",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Check circle scales in
  const circleProgress = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  // Checkmark draws in after circle
  const checkProgress = spring({
    fps,
    frame: frame - delay - 8,
    config: { ...SPRING_GENTLE, stiffness: 160 },
  });

  // Text fades in after checkmark
  const textProgress = spring({
    fps,
    frame: frame - delay - 14,
    config: SPRING_GENTLE,
  });

  const checkPathLength = 24;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        opacity: circleProgress,
        ...style,
      }}
    >
      {/* Check circle */}
      <svg width={40} height={40} viewBox="0 0 40 40">
        <circle
          cx={20}
          cy={20}
          r={18}
          fill={accent}
          opacity={0.15}
          transform={`scale(${circleProgress})`}
          style={{ transformOrigin: "center" }}
        />
        <circle
          cx={20}
          cy={20}
          r={18}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          transform={`scale(${circleProgress})`}
          style={{ transformOrigin: "center" }}
        />
        {/* Checkmark path */}
        <path
          d="M 12 20 L 18 26 L 28 14"
          fill="none"
          stroke={accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={checkPathLength}
          strokeDashoffset={checkPathLength * (1 - checkProgress)}
        />
      </svg>
      {/* Text */}
      <span
        style={{
          fontFamily: FONT.heading,
          fontSize: FONT_SIZE.body,
          fontWeight: 500,
          color: "rgba(255,255,255,0.9)",
          opacity: textProgress,
          transform: `translateX(${(1 - textProgress) * 10}px)`,
        }}
      >
        {text}
      </span>
    </div>
  );
};
