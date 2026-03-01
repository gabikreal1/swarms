import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { FONT, FONT_SIZE, SPRING_GENTLE } from "../theme";

interface OrbitItem {
  label: string;
}

interface HexNodeProps {
  label: string;
  score: number;
  targetScore: number;
  color?: string;
  delay?: number;
  orbitItems?: OrbitItem[];
  style?: React.CSSProperties;
}

/** Hexagonal node with score counter and orbiting mini-hexes */
export const HexNode: React.FC<HexNodeProps> = ({
  label,
  score,
  targetScore,
  color = "#5E5CE6",
  delay = 0,
  orbitItems = [],
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = 260;

  // Node scale-in
  const nodeProgress = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  // Score count-up
  const countProgress = spring({
    fps,
    frame: frame - delay - 15,
    config: { damping: 30, mass: 1, stiffness: 60 },
  });
  const displayScore = Math.round(
    interpolate(countProgress, [0, 1], [score, targetScore]),
  );

  // Hexagon points for center
  const hexPoints = (cx: number, cy: number, r: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return pts.join(" ");
  };

  const hexRadius = size * 0.42;
  const orbitRadius = size * 0.7;
  const miniHexR = 28;

  return (
    <div
      style={{
        position: "relative",
        width: size * 2,
        height: size * 2,
        ...style,
      }}
    >
      <svg
        width={size * 2}
        height={size * 2}
        viewBox={`0 0 ${size * 2} ${size * 2}`}
      >
        {/* Orbiting mini hexes */}
        {orbitItems.map((item, i) => {
          const orbitDelay = delay + 25 + i * 12;
          const orbitProgress = spring({
            fps,
            frame: frame - orbitDelay,
            config: SPRING_GENTLE,
          });
          const baseAngle = (Math.PI * 2 * i) / orbitItems.length - Math.PI / 2;
          const rotation = (frame - delay) * 0.003;
          const angle = baseAngle + rotation;
          const ox = size + orbitRadius * Math.cos(angle);
          const oy = size + orbitRadius * Math.sin(angle);

          return (
            <g key={i} opacity={orbitProgress}>
              <polygon
                points={hexPoints(ox, oy, miniHexR)}
                fill={color}
                opacity={0.25}
                stroke={color}
                strokeWidth={1.5}
              />
              <text
                x={ox}
                y={oy + 5}
                textAnchor="middle"
                fill="#fff"
                fontSize={11}
                fontFamily="SF Pro Display, sans-serif"
                fontWeight={500}
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {/* Main hex */}
        <g
          transform={`translate(${size}, ${size}) scale(${nodeProgress})`}
          style={{ transformOrigin: "center" }}
        >
          <polygon
            points={hexPoints(0, 0, hexRadius)}
            fill={color}
            opacity={0.12}
            stroke={color}
            strokeWidth={2.5}
          />
          {/* Agent name */}
          <text
            x={0}
            y={-15}
            textAnchor="middle"
            fill="#fff"
            fontSize={FONT_SIZE.body}
            fontFamily={FONT.heading}
            fontWeight={600}
          >
            {label}
          </text>
          {/* Score */}
          <text
            x={0}
            y={25}
            textAnchor="middle"
            fill={color}
            fontSize={36}
            fontFamily={FONT.mono}
            fontWeight={700}
          >
            {displayScore}
          </text>
        </g>
      </svg>
    </div>
  );
};
