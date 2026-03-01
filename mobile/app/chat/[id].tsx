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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import {
  USE_MOCKS,
  MOCK_CHAT_MESSAGES,
  GREETING_BLOCKS,
  CLARIFICATION_BLOCKS,
  ANALYSIS_BLOCKS,
} from '../../src/config/mock';
import { api, API_BASE } from '../../src/api/client';
import { initWallet } from '../../src/wallet/circle';
import BlockRenderer from '../../src/components/genui/BlockRenderer';

interface GenUIBlock {
  id: string;
  type: string;
  [key: string]: any;
}

interface Message {
  id: string;
  role: 'user' | 'butler';
  text: string;
  timestamp: number;
  blocks?: GenUIBlock[];
}

const PHASE_LABELS: Record<string, string> = {
  greeting: 'Getting started',
  clarification: 'Gathering details',
  analysis: 'Analyzing requirements',
  criteria_selection: 'Selecting criteria',
  posting: 'Posting job',
  awaiting_bids: 'Awaiting bids',
  bid_selection: 'Reviewing bids',
  execution: 'Agent working',
  delivery_review: 'Reviewing delivery',
  validation: 'Validating results',
  completed: 'Completed',
  status_inquiry: 'Checking status',
};

const MOCK_AGENT_REPLIES = [
  'I\'m working on that right now. Give me a moment to analyze the contract.',
  'Good question. Based on my analysis, the approve function lacks input validation for the zero address.',
  'I\'ve found a potential reentrancy vector in the withdrawal flow. I\'ll include remediation steps in my report.',
  'The gas benchmarks are looking promising — I\'m seeing a 34% reduction so far on the mint function.',
  'I\'ve completed this section. Moving on to the next set of tests now.',
  'Here\'s what I recommend: add a nonReentrant modifier and emit events on all state changes.',
];

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const { colors, typography } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>('greeting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [walletReady, setWalletReady] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const mockReplyIndex = useRef(0);
  const eventSourceRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Initialize wallet
  useEffect(() => {
    (async () => {
      try {
        const w = await initWallet();
        setWalletAddress(w.address);
      } catch (e: any) {
        console.error('[chat] wallet init failed:', e?.message);
      } finally {
        setWalletReady(true);
      }
    })();
  }, []);

  // Load initial data
  useEffect(() => {
    if (USE_MOCKS) {
      // In mock mode, show greeting blocks
      setMessages([
        {
          id: 'greeting-mock',
          role: 'butler',
          text: '',
          timestamp: Date.now(),
          blocks: GREETING_BLOCKS as GenUIBlock[],
        },
      ]);
      setPhase('greeting');
      return;
    }

    // If chatId is "new", start a fresh session
    if (chatId === 'new') {
      sendToButler({ message: '' }); // Trigger greeting
      return;
    }

    // Load existing session
    loadSession(chatId);
  }, [chatId]);

  // Connect SSE when sessionId is available
  useEffect(() => {
    if (USE_MOCKS || !sessionId) return;

    connectSSE(sessionId);
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [sessionId]);

  const loadSession = async (sid: string) => {
    try {
      setLoading(true);
      const session = await api.getChatSession(sid);
      setSessionId(session.sessionId);
      setPhase(session.phase);

      // Convert backend messages to local format
      const loaded: Message[] = session.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        text: '',
        timestamp: new Date(m.timestamp).getTime(),
        blocks: m.blocks,
      }));
      setMessages(loaded);
    } catch (err) {
      console.error('[chat] load session error:', err);
      // Start fresh if session not found
      sendToButler({ message: '' });
    } finally {
      setLoading(false);
    }
  };

  const connectSSE = (sid: string) => {
    try {
      const EventSource = require('react-native-sse').default;
      const url = `${API_BASE}/v1/chat/${sid}/stream`;

      eventSourceRef.current?.close();
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          retryCountRef.current = 0;
          setConnectionError(null);

          switch (data.type) {
            case 'connected':
              break;

            case 'block_start':
              setAgentTyping(true);
              break;

            case 'block_delta':
              // For streaming text blocks — append delta to existing block
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'butler' && last.blocks) {
                  const blockIdx = last.blocks.findIndex(
                    (b) => b.id === data.blockId,
                  );
                  if (blockIdx >= 0 && last.blocks[blockIdx].type === 'text') {
                    const updatedBlocks = [...last.blocks];
                    updatedBlocks[blockIdx] = {
                      ...updatedBlocks[blockIdx],
                      content:
                        (updatedBlocks[blockIdx].content || '') + data.delta,
                    };
                    return [
                      ...prev.slice(0, -1),
                      { ...last, blocks: updatedBlocks },
                    ];
                  }
                }
                return prev;
              });
              scrollToEnd();
              break;

            case 'block_complete':
              // Full block received — add or replace in last butler message
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'butler') {
                  const blocks = last.blocks || [];
                  const existingIdx = blocks.findIndex(
                    (b) => b.id === data.blockId,
                  );
                  let updatedBlocks: GenUIBlock[];
                  if (existingIdx >= 0) {
                    updatedBlocks = [...blocks];
                    updatedBlocks[existingIdx] = data.block;
                  } else {
                    updatedBlocks = [...blocks, data.block];
                  }
                  return [
                    ...prev.slice(0, -1),
                    { ...last, blocks: updatedBlocks },
                  ];
                }
                // Create new butler message
                return [
                  ...prev,
                  {
                    id: data.blockId,
                    role: 'butler' as const,
                    text: '',
                    timestamp: Date.now(),
                    blocks: [data.block],
                  },
                ];
              });
              scrollToEnd();
              break;

            case 'phase_change':
              setPhase(data.phase);
              break;

            case 'done':
              setAgentTyping(false);
              break;

            case 'error':
              setAgentTyping(false);
              setMessages((prev) => [
                ...prev,
                {
                  id: `err-${Date.now()}`,
                  role: 'butler',
                  text: `Error: ${data.message}`,
                  timestamp: Date.now(),
                },
              ]);
              break;
          }
        } catch {}
      });

      es.addEventListener('error', () => {
        setAgentTyping(false);
        retryCountRef.current++;
        if (retryCountRef.current <= MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          setTimeout(() => {
            if (sessionId) connectSSE(sessionId);
          }, delay);
        } else {
          setConnectionError('Connection lost. Pull down to retry.');
        }
      });
    } catch (err) {
      console.error('[chat] SSE connection error:', err);
    }
  };

  const sendToButler = async (payload: {
    message?: string;
    formResponse?: { formId: string; values: Record<string, string> };
    actionResponse?: {
      actionId: string;
      toolCall?: string;
      toolArgs?: Record<string, unknown>;
    };
    criteriaResponse?: {
      selectedIds: string[];
      customCriteria?: string[];
    };
    tagsResponse?: { selectedTags: string[] };
  }) => {
    if (!walletAddress && !USE_MOCKS) {
      Alert.alert('Wallet Not Ready', 'Please wait for the wallet to connect before sending messages.');
      return;
    }

    setAgentTyping(true);

    if (USE_MOCKS) {
      // Mock mode: simulate different block responses
      await mockButlerResponse(payload);
      setAgentTyping(false);
      return;
    }

    try {
      const result = await api.chatMessage({
        sessionId: sessionId || undefined,
        walletAddress: walletAddress!,
        message: payload.message || '',
        formResponse: payload.formResponse,
        actionResponse: payload.actionResponse,
        criteriaResponse: payload.criteriaResponse,
        tagsResponse: payload.tagsResponse,
      });

      // Set session ID from response
      if (!sessionId) {
        setSessionId(result.sessionId);
      }

      setPhase(result.phase);

      // Add butler response to messages
      const butlerMsg: Message = {
        id: result.message.id,
        role: 'butler',
        text: '',
        timestamp: new Date(result.message.timestamp).getTime(),
        blocks: result.message.blocks,
      };
      setMessages((prev) => [...prev, butlerMsg]);
      scrollToEnd();
    } catch (err) {
      console.error('[chat] send error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'butler',
          text: 'Something went wrong. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setAgentTyping(false);
    }
  };

  const mockButlerResponse = async (payload: any) => {
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

    if (payload.actionResponse) {
      // Show clarification form after selecting a vertical
      setPhase('clarification');
      setMessages((prev) => [
        ...prev,
        {
          id: `butler-${Date.now()}`,
          role: 'butler',
          text: '',
          timestamp: Date.now(),
          blocks: CLARIFICATION_BLOCKS as GenUIBlock[],
        },
      ]);
    } else if (payload.formResponse) {
      // Show analysis after form submission
      setPhase('analysis');
      setMessages((prev) => [
        ...prev,
        {
          id: `butler-${Date.now()}`,
          role: 'butler',
          text: '',
          timestamp: Date.now(),
          blocks: ANALYSIS_BLOCKS as GenUIBlock[],
        },
      ]);
    } else if (payload.message) {
      // Plain text reply
      const reply =
        MOCK_AGENT_REPLIES[
          mockReplyIndex.current % MOCK_AGENT_REPLIES.length
        ];
      mockReplyIndex.current++;
      setMessages((prev) => [
        ...prev,
        {
          id: `butler-${Date.now()}`,
          role: 'butler',
          text: reply,
          timestamp: Date.now(),
        },
      ]);
    }
    scrollToEnd();
  };

  // GenUI callbacks
  const handleAction = (
    actionId: string,
    toolCall?: string,
    toolArgs?: Record<string, unknown>,
  ) => {
    sendToButler({
      actionResponse: { actionId, toolCall, toolArgs },
    });
  };

  const handleFormSubmit = (formId: string, values: Record<string, string>) => {
    // Add user's form submission as a visible message
    const summary = Object.entries(values)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    if (summary) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-form-${Date.now()}`,
          role: 'user',
          text: summary,
          timestamp: Date.now(),
        },
      ]);
    }

    sendToButler({
      formResponse: { formId, values },
    });
  };

  const handleCriteriaChange = (
    selectedIds: string[],
    customCriteria?: string[],
  ) => {
    // Debounce: criteria changes fire on every toggle. Only send on
    // explicit submit (via the action button).
    // Store locally for now — the action handler will pick it up.
    criteriaRef.current = { selectedIds, customCriteria };
  };

  const criteriaRef = useRef<{
    selectedIds: string[];
    customCriteria?: string[];
  } | null>(null);

  const handleTagsChange = (selectedTags: string[]) => {
    tagsRef.current = selectedTags;
  };

  const tagsRef = useRef<string[]>([]);

  // Override action handler to include accumulated criteria/tags
  const handleActionWithContext = (
    actionId: string,
    toolCall?: string,
    toolArgs?: Record<string, unknown>,
  ) => {
    if (actionId === 'confirm-criteria' && criteriaRef.current) {
      sendToButler({
        actionResponse: { actionId, toolCall, toolArgs },
        criteriaResponse: criteriaRef.current,
        tagsResponse: tagsRef.current.length > 0
          ? { selectedTags: tagsRef.current }
          : undefined,
      });
      criteriaRef.current = null;
      tagsRef.current = [];
      return;
    }
    handleAction(actionId, toolCall, toolArgs);
  };

  const sendTextMessage = async () => {
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
    scrollToEnd();

    sendToButler({ message: text });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const hasBlocks = item.blocks && item.blocks.length > 0;

    if (isUser) {
      return (
        <View
          style={[
            styles.bubble,
            styles.bubbleUser,
            { backgroundColor: colors.tint },
          ]}
        >
          <Text style={[typography.body, { color: '#FFFFFF' }]}>
            {item.text}
          </Text>
          <Text
            style={[
              typography.caption2,
              {
                color: 'rgba(255,255,255,0.6)',
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
    }

    if (hasBlocks) {
      return (
        <View
          style={[
            styles.bubble,
            styles.bubbleAgent,
            styles.blocksBubble,
            { backgroundColor: colors.secondarySystemBackground },
          ]}
        >
          {item.blocks!.map((block) => (
            <View key={block.id} style={styles.blockWrapper}>
              <BlockRenderer
                block={block}
                onAction={handleActionWithContext}
                onFormSubmit={handleFormSubmit}
                onCriteriaChange={handleCriteriaChange}
                onTagsChange={handleTagsChange}
              />
            </View>
          ))}
          <Text
            style={[
              typography.caption2,
              {
                color: colors.tertiaryLabel,
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
    }

    // Plain text butler message
    if (!item.text) return null;

    return (
      <View
        style={[
          styles.bubble,
          styles.bubbleAgent,
          { backgroundColor: colors.secondarySystemBackground },
        ]}
      >
        <Text style={[typography.body, { color: colors.label }]}>
          {item.text}
        </Text>
        <Text
          style={[
            typography.caption2,
            {
              color: colors.tertiaryLabel,
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

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.systemBackground },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Phase indicator */}
      <View
        style={[
          styles.phaseBar,
          {
            backgroundColor: colors.secondarySystemBackground,
            borderBottomColor: colors.separator,
          },
        ]}
      >
        <View
          style={[
            styles.phaseDot,
            {
              backgroundColor:
                phase === 'completed'
                  ? colors.systemGreen
                  : colors.tint,
            },
          ]}
        />
        <Text
          style={[typography.footnote, { color: colors.secondaryLabel }]}
        >
          {PHASE_LABELS[phase] || phase}
        </Text>
        {connectionError && (
          <Text
            style={[
              typography.caption2,
              { color: colors.destructive, marginLeft: 'auto' },
            ]}
          >
            {connectionError}
          </Text>
        )}
      </View>

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
          <View
            style={[
              styles.typingDot,
              { backgroundColor: colors.tint, opacity: 0.6 },
            ]}
          />
          <View
            style={[
              styles.typingDot,
              { backgroundColor: colors.tint, opacity: 0.4 },
            ]}
          />
          <View
            style={[
              styles.typingDot,
              { backgroundColor: colors.tint, opacity: 0.2 },
            ]}
          />
          <Text
            style={[
              typography.caption1,
              { color: colors.tertiaryLabel, marginLeft: 4 },
            ]}
          >
            Butler is thinking...
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
          onSubmitEditing={sendTextMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: colors.tint,
              opacity: input.trim() && (walletReady || USE_MOCKS) ? 1 : 0.4,
            },
          ]}
          onPress={sendTextMessage}
          disabled={!input.trim() || (!walletReady && !USE_MOCKS)}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Wallet status indicator */}
      {!walletReady && !USE_MOCKS && (
        <View style={[styles.walletBar, { backgroundColor: colors.systemOrange + '22' }]}>
          <ActivityIndicator size="small" color={colors.systemOrange} />
          <Text style={[typography.caption2, { color: colors.systemOrange, marginLeft: 6 }]}>
            Connecting wallet...
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  phaseDot: {
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
  blocksBubble: {
    maxWidth: '95%',
  },
  blockWrapper: {
    marginBottom: 10,
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
  walletBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
});
