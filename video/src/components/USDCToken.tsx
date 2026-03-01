import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SPRING_GENTLE } from "../theme";

interface USDCTokenProps {
  size?: number;
  delay?: number;
  label?: string;
  style?: React.CSSProperties;
}

/** USDC coin icon with optional label */
export const USDCToken: React.FC<USDCTokenProps> = ({
  size = 48,
  delay = 0,
  label,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        transform: `scale(${scale})`,
        opacity: scale,
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 48 48">
        <circle cx={24} cy={24} r={23} fill="#2775CA" stroke="#fff" strokeWidth={1} />
        <text
          x={24}
          y={30}
          textAnchor="middle"
          fill="#fff"
          fontSize={20}
          fontWeight={700}
          fontFamily="SF Pro Display, sans-serif"
        >
          $
        </text>
      </svg>
      {label && (
        <span
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: 600,
            fontFamily: "SF Pro Display, sans-serif",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
