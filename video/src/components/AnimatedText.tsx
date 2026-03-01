import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FONT, MOTION, SPRING_GENTLE } from "../theme";

interface AnimatedTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  delay?: number;
  style?: React.CSSProperties;
}

/** Word-by-word spring reveal */
export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  fontSize = 64,
  color = "#FFFFFF",
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 18px",
        fontFamily: FONT.heading,
        fontSize,
        fontWeight: 700,
        lineHeight: 1.15,
        color,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const wordDelay = delay + i * MOTION.wordStagger;
        const progress = spring({
          fps,
          frame: frame - wordDelay,
          config: SPRING_GENTLE,
        });
        return (
          <span
            key={i}
            style={{
              opacity: progress,
              transform: `translateY(${(1 - progress) * 20}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
