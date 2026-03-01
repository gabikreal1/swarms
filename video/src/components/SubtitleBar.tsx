import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FONT, FONT_SIZE, SPRING_GENTLE } from "../theme";

interface SubtitleBarProps {
  text: string;
  delay?: number;
  color?: string;
}

/** Bottom-positioned subtitle with fade-up */
export const SubtitleBar: React.FC<SubtitleBarProps> = ({
  text,
  delay = 20,
  color = "rgba(255,255,255,0.7)",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT.heading,
        fontSize: FONT_SIZE.subtitle,
        fontWeight: 400,
        color,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 12}px)`,
        padding: "0 120px",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
};
