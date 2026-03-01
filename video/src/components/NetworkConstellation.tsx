import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SPRING_GENTLE } from "../theme";

interface NetworkConstellationProps {
  nodeCount?: number;
  color?: string;
  delay?: number;
}

interface Node {
  x: number;
  y: number;
  size: number;
}

/** Constellation of interconnected nodes that slowly rotates */
export const NetworkConstellation: React.FC<NetworkConstellationProps> = ({
  nodeCount = 20,
  color = "#2997FF",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  // Generate deterministic nodes
  const nodes: Node[] = useMemo(() => {
    const result: Node[] = [];
    for (let i = 0; i < nodeCount; i++) {
      // Use seeded pseudo-random placement in a circular area
      const angle = (i / nodeCount) * Math.PI * 2 + (i * 1.618);
      const radius = 60 + (i % 7) * 22 + (i % 3) * 15;
      result.push({
        x: 200 + Math.cos(angle) * radius,
        y: 200 + Math.sin(angle) * radius,
        size: 3 + (i % 4),
      });
    }
    return result;
  }, [nodeCount]);

  // Generate edges between nearby nodes
  const edges = useMemo(() => {
    const result: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          result.push([i, j]);
        }
      }
    }
    return result;
  }, [nodes]);

  // Slow rotation
  const rotation = frame * 0.15;

  return (
    <div
      style={{
        width: 400,
        height: 400,
        position: "relative",
        opacity: entry,
        transform: `rotate(${rotation}deg) scale(${entry})`,
      }}
    >
      <svg width={400} height={400} viewBox="0 0 400 400">
        {/* Edges */}
        {edges.map(([a, b], i) => (
          <line
            key={`e-${i}`}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke={color}
            strokeWidth={0.8}
            opacity={0.15}
          />
        ))}
        {/* Nodes */}
        {nodes.map((node, i) => (
          <g key={`n-${i}`}>
            {/* Glow */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size * 3}
              fill={color}
              opacity={0.08}
            />
            {/* Core */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size}
              fill={color}
              opacity={0.8}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};
