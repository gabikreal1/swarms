import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FONT, FONT_SIZE, SPRING_GENTLE } from "../theme";

interface ChatMessage {
  text: string;
  sender: "user" | "butler" | "system";
}

interface ChatCardProps {
  messages: ChatMessage[];
  delay?: number;
  accent?: string;
  style?: React.CSSProperties;
}

/** Typing frames per character within the chat card */
const CHARS_PER_FRAME = 0.8;
/** Pause between messages in frames */
const MESSAGE_GAP = 25;

/** Dark card with sequentially-appearing typed chat bubbles */
export const ChatCard: React.FC<ChatCardProps> = ({
  messages,
  delay = 0,
  accent = "#BF5AF2",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card fade-in
  const cardProgress = spring({
    fps,
    frame: frame - delay,
    config: SPRING_GENTLE,
  });

  // Calculate cumulative start frames for each message
  const messageTimings: { start: number; typeFrames: number }[] = [];
  let cursor = delay + 15; // small offset after card appears
  for (const msg of messages) {
    const typeFrames = Math.ceil(msg.text.length / CHARS_PER_FRAME);
    messageTimings.push({ start: cursor, typeFrames });
    cursor += typeFrames + MESSAGE_GAP;
  }

  return (
    <div
      style={{
        width: 800,
        minHeight: 480,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: 40,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        opacity: cardProgress,
        transform: `scale(${0.95 + 0.05 * cardProgress})`,
        ...style,
      }}
    >
      {messages.map((msg, i) => {
        const timing = messageTimings[i];
        const elapsed = Math.max(0, frame - timing.start);
        const charsVisible = Math.min(
          msg.text.length,
          Math.floor(elapsed * CHARS_PER_FRAME),
        );

        // Don't render message until its start time
        if (frame < timing.start) return null;

        const isUser = msg.sender === "user";
        const isSystem = msg.sender === "system";
        const doneTyping = charsVisible >= msg.text.length;
        const cursorVisible = doneTyping
          ? Math.floor(elapsed / 15) % 2 === 0
          : true;

        return (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                padding: "16px 22px",
                borderRadius: 14,
                background: isSystem
                  ? "rgba(255,255,255,0.08)"
                  : isUser
                    ? "rgba(255,255,255,0.1)"
                    : accent,
                fontFamily: isSystem ? FONT.mono : FONT.heading,
                fontSize: isSystem ? FONT_SIZE.label : FONT_SIZE.body,
                fontWeight: isSystem ? 500 : 400,
                color: "#FFFFFF",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {!isUser && !isSystem && (
                <div
                  style={{
                    fontSize: FONT_SIZE.label,
                    fontWeight: 600,
                    marginBottom: 6,
                    opacity: 0.7,
                  }}
                >
                  Butler
                </div>
              )}
              {msg.text.slice(0, charsVisible)}
              {!doneTyping && (
                <span style={{ opacity: cursorVisible ? 0.6 : 0, marginLeft: 1 }}>
                  |
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
