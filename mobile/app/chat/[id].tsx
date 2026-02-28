import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { USE_MOCKS, MOCK_CHAT_MESSAGES } from '../../src/config/mock';

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const MOCK_AGENT_REPLIES = [
  'I\'m working on that right now. Give me a moment to analyze the contract.',
  'Good question. Based on my analysis, the approve function lacks input validation for the zero address.',
  'I\'ve found a potential reentrancy vector in the withdrawal flow. I\'ll include remediation steps in my report.',
  'The gas benchmarks are looking promising — I\'m seeing a 34% reduction so far on the mint function.',
  'I\'ve completed this section. Moving on to the next set of tests now.',
  'Here\'s what I recommend: add a nonReentrant modifier and emit events on all state changes.',
];

export default function ChatScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const { colors, typography } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [agentTyping, setAgentTyping] = useState(false);
  const [progress, setProgress] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const mockReplyIndex = useRef(0);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Load mock messages or connect SSE
  useEffect(() => {
    if (USE_MOCKS) {
      setMessages(MOCK_CHAT_MESSAGES);
      setProgress('Agent is auditing the contract...');
      return;
    }

    const es = connectSSE();
    return () => {
      es?.close();
    };
  }, []);

  const connectSSE = useCallback(() => {
    const url = `${API_BASE}/v1/chat/${jobId}/stream`;
    try {
      const EventSource = require('react-native-sse').default;
      const eventSource = new EventSource(url);

      eventSource.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'token') {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'agent' && last.id === data.messageId) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + data.token },
                ];
              }
              return [
                ...prev,
                {
                  id: data.messageId,
                  role: 'agent',
                  text: data.token,
                  timestamp: Date.now(),
                },
              ];
            });
            setAgentTyping(true);
            scrollToEnd();
          } else if (data.type === 'done') {
            setAgentTyping(false);
          } else if (data.type === 'progress') {
            setProgress(data.status || '');
          } else if (data.type === 'error') {
            setMessages((prev) => [
              ...prev,
              {
                id: `err-${Date.now()}`,
                role: 'agent',
                text: `Error: ${data.message}`,
                timestamp: Date.now(),
              },
            ]);
            setAgentTyping(false);
          }
        } catch {}
      });

      eventSource.addEventListener('error', () => {
        setAgentTyping(false);
      });

      return eventSource;
    } catch {
      return null;
    }
  }, [jobId, scrollToEnd]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAgentTyping(true);
    scrollToEnd();

    if (USE_MOCKS) {
      // Simulate agent reply after a delay
      setTimeout(() => {
        const reply = MOCK_AGENT_REPLIES[mockReplyIndex.current % MOCK_AGENT_REPLIES.length];
        mockReplyIndex.current++;
        setMessages((prev) => [
          ...prev,
          {
            id: `agent-mock-${Date.now()}`,
            role: 'agent',
            text: reply,
            timestamp: Date.now(),
          },
        ]);
        setAgentTyping(false);
        scrollToEnd();
      }, 1200 + Math.random() * 1000);
      return;
    }

    try {
      await fetch(`${API_BASE}/v1/chat/${jobId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
    } catch {
      setAgentTyping(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.tint }]
            : [styles.bubbleAgent, { backgroundColor: colors.secondarySystemBackground }],
        ]}
      >
        <Text
          style={[
            typography.body,
            { color: isUser ? '#FFFFFF' : colors.label },
          ]}
        >
          {item.text}
        </Text>
        <Text
          style={[
            typography.caption2,
            {
              color: isUser ? 'rgba(255,255,255,0.6)' : colors.tertiaryLabel,
              alignSelf: 'flex-end',
              marginTop: 4,
            },
          ]}
        >
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Progress bar */}
      {progress !== '' && (
        <View
          style={[
            styles.progressBar,
            {
              backgroundColor: colors.secondarySystemBackground,
              borderBottomColor: colors.separator,
            },
          ]}
        >
          <View style={[styles.progressDot, { backgroundColor: colors.tint }]} />
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
            {progress}
          </Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToEnd}
      />

      {/* Typing indicator */}
      {agentTyping && (
        <View style={styles.typingRow}>
          <View style={[styles.typingDot, { backgroundColor: colors.tint, opacity: 0.6 }]} />
          <View style={[styles.typingDot, { backgroundColor: colors.tint, opacity: 0.4 }]} />
          <View style={[styles.typingDot, { backgroundColor: colors.tint, opacity: 0.2 }]} />
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginLeft: 4 }]}>
            Agent is thinking...
          </Text>
        </View>
      )}

      {/* Input */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.tertiarySystemBackground,
            borderTopColor: colors.separator,
          },
        ]}
      >
        <TextInput
          style={[
            typography.body,
            styles.input,
            {
              backgroundColor: colors.secondarySystemBackground,
              color: colors.label,
              borderColor: colors.separator,
            },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.tertiaryLabel}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: colors.tint,
              opacity: input.trim() ? 1 : 0.4,
            },
          ]}
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
