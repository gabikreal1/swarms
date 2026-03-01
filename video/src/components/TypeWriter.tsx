import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { FONT } from "../theme";

interface TypeWriterProps {
  text: string;
  /** Frames per character */
  speed?: number;
  delay?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  style?: React.CSSProperties;
}

/** Character-by-character text reveal with blinking cursor */
export const TypeWriter: React.FC<TypeWriterProps> = ({
  text,
  speed = 2,
  delay = 0,
  fontSize = 22,
  color = "#FFFFFF",
  fontFamily = FONT.mono,
  style,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - delay);
  const charsVisible = Math.min(text.length, Math.floor(elapsed / speed));

  const doneTyping = charsVisible >= text.length;

  // Blink cursor every 15 frames when done typing
  const cursorVisible = doneTyping
    ? Math.floor(elapsed / 15) % 2 === 0
    : true;

  // Fade in the whole container
  const containerOpacity = interpolate(elapsed, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        color,
        opacity: containerOpacity,
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
        ...style,
      }}
    >
      {text.slice(0, charsVisible)}
      <span
        style={{
          opacity: cursorVisible ? 1 : 0,
          color,
          marginLeft: 1,
        }}
      >
        |
      </span>
    </div>
  );
};
