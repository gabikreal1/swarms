import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FONT, SPRING_GENTLE } from "../theme";
import { TypeWriter } from "./TypeWriter";

interface TerminalWindowProps {
  lines: string[];
  delay?: number;
  /** Frames per character */
  typingSpeed?: number;
  accent?: string;
}

/** Styled terminal window with line-by-line typing animation */
export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  lines,
  delay = 0,
  typingSpeed = 1.5,
  accent = "#2997FF",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  // Calculate when each line starts based on previous line length
  const lineDelays: number[] = [];
  let accumulated = delay + 10; // 10 frames after window appears
  for (let i = 0; i < lines.length; i++) {
    lineDelays.push(accumulated);
    // Each line finishes after its chars * speed, then 30 frame gap
    accumulated += lines[i].length * typingSpeed + 30;
  }

  return (
    <div
      style={{
        width: 860,
        height: 440,
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden",
        opacity: entry,
        transform: `scale(${0.9 + entry * 0.1})`,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FEBC2E" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28C840" }} />
        <span
          style={{
            marginLeft: 12,
            fontFamily: FONT.mono,
            fontSize: 13,
            color: "rgba(255,255,255,0.35)",
          }}
        >
          terminal
        </span>
      </div>
      {/* Terminal body */}
      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {lines.map((line, i) => {
          const lineStart = lineDelays[i];
          const isVisible = frame >= lineStart;
          if (!isVisible) return null;

          const isPrompt = line.startsWith("$ ") || line.startsWith("> ");
          const promptChar = isPrompt ? line.slice(0, 2) : "";
          const content = isPrompt ? line.slice(2) : line;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                minHeight: 28,
              }}
            >
              {promptChar && (
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 18,
                    color: line.startsWith("$ ") ? accent : "rgba(255,255,255,0.5)",
                    whiteSpace: "pre",
                    flexShrink: 0,
                  }}
                >
                  {promptChar}
                </span>
              )}
              <TypeWriter
                text={content}
                speed={typingSpeed}
                delay={lineStart}
                fontSize={18}
                color={
                  line.includes("\u2713")
                    ? "#30D158"
                    : line.startsWith("> ")
                      ? "rgba(255,255,255,0.7)"
                      : "#FFFFFF"
                }
                fontFamily={FONT.mono}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
