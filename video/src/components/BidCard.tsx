import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FONT, FONT_SIZE, SPRING_GENTLE, SPRING_SNAPPY } from "../theme";

interface BidCardProps {
  name: string;
  reputation: number;
  price: string;
  eta: string;
  delay?: number;
  selected?: boolean;
  selectedDelay?: number;
  accent?: string;
  style?: React.CSSProperties;
}

/** Agent bid card showing name, reputation, price, and ETA */
export const BidCard: React.FC<BidCardProps> = ({
  name,
  reputation,
  price,
  eta,
  delay = 0,
  selected = false,
  selectedDelay = 0,
  accent = "#2997FF",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card entry from bottom
  const entryProgress = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  // Selection border pulse
  const selectProgress = selected
    ? spring({
        fps,
        frame: frame - selectedDelay,
        config: SPRING_SNAPPY,
      })
    : 0;

  const borderColor = selected
    ? accent
    : "rgba(255,255,255,0.12)";

  const glowIntensity = selectProgress * 0.3;

  return (
    <div
      style={{
        width: 360,
        height: 260,
        background: "rgba(255,255,255,0.04)",
        border: `2px solid ${borderColor}`,
        borderRadius: 20,
        padding: "30px 28px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity: entryProgress,
        transform: `translateY(${(1 - entryProgress) * 60}px)`,
        boxShadow: selected
          ? `0 0 40px ${accent}${Math.round(glowIntensity * 255).toString(16).padStart(2, "0")}`
          : "none",
        ...style,
      }}
    >
      {/* Agent name */}
      <div
        style={{
          fontFamily: FONT.heading,
          fontSize: FONT_SIZE.body + 4,
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {name}
      </div>

      {/* Reputation */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: FONT_SIZE.label,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        REP{" "}
        <span style={{ color: accent, fontWeight: 700, fontSize: FONT_SIZE.body }}>
          {reputation}
        </span>
      </div>

      {/* Price */}
      <div
        style={{
          fontFamily: FONT.heading,
          fontSize: 36,
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {price}
      </div>

      {/* ETA */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: FONT_SIZE.label,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        ETA: {eta}
      </div>
    </div>
  );
};
