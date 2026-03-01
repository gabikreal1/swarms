import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { FONT, FONT_SIZE, SPRING_GENTLE } from "../theme";

interface TimelineBarProps {
  stages: string[];
  activeIndex: number;
  delay?: number;
  accent?: string;
  style?: React.CSSProperties;
}

/** Horizontal job lifecycle progress bar with animated stage dots */
export const TimelineBar: React.FC<TimelineBarProps> = ({
  stages,
  activeIndex,
  delay = 0,
  accent = "#FFD60A",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barWidth = 700;
  const dotSize = 18;
  const spacing = barWidth / (stages.length - 1);

  // Overall bar fade-in
  const barProgress = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: barProgress,
        transform: `translateY(${(1 - barProgress) * 20}px)`,
        ...style,
      }}
    >
      {/* Bar + Dots */}
      <div style={{ position: "relative", width: barWidth, height: 50 }}>
        {/* Background line */}
        <div
          style={{
            position: "absolute",
            top: dotSize / 2 - 1.5,
            left: 0,
            width: barWidth,
            height: 3,
            background: "rgba(255,255,255,0.15)",
            borderRadius: 2,
          }}
        />
        {/* Active line */}
        <div
          style={{
            position: "absolute",
            top: dotSize / 2 - 1.5,
            left: 0,
            width: interpolate(activeIndex, [0, stages.length - 1], [0, barWidth]),
            height: 3,
            background: accent,
            borderRadius: 2,
          }}
        />
        {/* Dots */}
        {stages.map((_, i) => {
          const isActive = i <= activeIndex;
          const dotProgress = spring({
            fps,
            frame: frame - delay - i * 10,
            config: SPRING_GENTLE,
          });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: i * spacing - dotSize / 2,
                top: 0,
                width: dotSize,
                height: dotSize,
                borderRadius: "50%",
                background: isActive ? accent : "rgba(255,255,255,0.2)",
                border: `2px solid ${isActive ? accent : "rgba(255,255,255,0.3)"}`,
                transform: `scale(${dotProgress})`,
                boxShadow: isActive ? `0 0 12px ${accent}40` : "none",
              }}
            />
          );
        })}
      </div>
      {/* Labels */}
      <div style={{ position: "relative", width: barWidth, height: 30, marginTop: 10 }}>
        {stages.map((stage, i) => {
          const isActive = i <= activeIndex;
          const labelProgress = spring({
            fps,
            frame: frame - delay - i * 10 - 5,
            config: SPRING_GENTLE,
          });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: i * spacing,
                transform: "translateX(-50%)",
                fontFamily: FONT.heading,
                fontSize: FONT_SIZE.label,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? accent : "rgba(255,255,255,0.5)",
                opacity: labelProgress,
                whiteSpace: "nowrap",
              }}
            >
              {stage}
            </div>
          );
        })}
      </div>
    </div>
  );
};
