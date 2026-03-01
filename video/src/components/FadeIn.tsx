import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SPRING_GENTLE } from "../theme";

interface FadeInProps {
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/** Directional fade-in wrapper using spring */
export const FadeIn: React.FC<FadeInProps> = ({
  delay = 0,
  direction = "up",
  distance = 30,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  const translate: Record<string, string> = {
    up: `translateY(${(1 - progress) * distance}px)`,
    down: `translateY(${(1 - progress) * -distance}px)`,
    left: `translateX(${(1 - progress) * distance}px)`,
    right: `translateX(${(1 - progress) * -distance}px)`,
    none: "none",
  };

  return (
    <div
      style={{
        opacity: progress,
        transform: translate[direction],
        ...style,
      }}
    >
      {children}
    </div>
  );
};
