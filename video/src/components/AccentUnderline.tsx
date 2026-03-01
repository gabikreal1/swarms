import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SPRING_SNAPPY } from "../theme";

interface AccentUnderlineProps {
  color: string;
  width?: number;
  delay?: number;
}

/** Gradient underline that draws in from left */
export const AccentUnderline: React.FC<AccentUnderlineProps> = ({
  color,
  width = 200,
  delay = 25,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: frame - delay,
    config: SPRING_SNAPPY,
  });

  return (
    <div
      style={{
        width: width * progress,
        height: 3,
        background: `linear-gradient(90deg, ${color}, transparent)`,
        margin: "12px auto 0",
        borderRadius: 2,
      }}
    />
  );
};
