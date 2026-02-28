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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function ChatScreen({ route }: Props) {
  const { jobId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [agentTyping, setAgentTyping] = useState(false);
  const [progress, setProgress] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // SSE connection for real-time agent responses
  const connectSSE = useCallback(() => {
    const url = `${API_BASE}/v1/chat/${jobId}/stream`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('message', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'token') {
          // Streaming token - append to last agent message
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
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener('error', () => {
      setAgentTyping(false);
    });

    return eventSource;
  }, [jobId, scrollToEnd]);

  useEffect(() => {
    const es = connectSSE();
    return () => {
      es.close();
    };
  }, [connectSSE]);

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
          isUser ? styles.bubbleUser : styles.bubbleAgent,
        ]}
      >
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {item.text}
        </Text>
        <Text style={styles.timestamp}>
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Progress bar */}
      {progress !== '' && (
        <View style={styles.progressBar}>
          <View style={styles.progressDot} />
          <Text style={styles.progressText}>{progress}</Text>
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
          <View style={styles.typingDot} />
          <View style={[styles.typingDot, styles.typingDot2]} />
          <View style={[styles.typingDot, styles.typingDot3]} />
          <Text style={styles.typingText}>Agent is thinking...</Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#6a6a8a"
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Text style={styles.sendBtnText}>&#9654;</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CC9F0',
  },
  progressText: {
    color: '#a0a0b8',
    fontSize: 13,
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
    backgroundColor: '#4CC9F0',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: '#1a1a2e',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  bubbleText: {
    color: '#e0e0e0',
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: '#0f0f23',
  },
  timestamp: {
    color: '#6a6a8a',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
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
    backgroundColor: '#4CC9F0',
    opacity: 0.6,
  },
  typingDot2: {
    opacity: 0.4,
  },
  typingDot3: {
    opacity: 0.2,
  },
  typingText: {
    color: '#6a6a8a',
    fontSize: 12,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f0f23',
    color: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4CC9F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#0f0f23',
    fontSize: 18,
  },
});
