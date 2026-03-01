import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { useButlerChat, PHASE_LABELS, Message } from '../../src/hooks/useButlerChat';
import { api } from '../../src/api/client';
import { initWallet } from '../../src/wallet/circle';
import BlockRenderer from '../../src/components/genui/BlockRenderer';
import AnimatedBlock from '../../src/components/genui/AnimatedBlock';

interface SessionSummary {
  sessionId: string;
  phase: string;
  createdAt: string;
  updatedAt: string;
}

export default function ButlerTab() {
  const { colors, typography } = useTheme();
  const [currentChatId, setCurrentChatId] = useState<string>('new');
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);

  const {
    messages,
    input,
    setInput,
    loading,
    agentTyping,
    phase,
    connectionError,
    walletReady,
    walletError,
    retryWallet,
    scrollRef,
    scrollToEnd,
    sendTextMessage,
    handleActionWithContext,
    handleFormSubmit,
    handleCriteriaChange,
    handleTagsChange,
    streamingBlockIds,
  } = useButlerChat(currentChatId);

  // Get wallet address for session queries
  useEffect(() => {
    initWallet().then(w => setWalletAddr(w.address)).catch(() => {});
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!walletAddr) return;
    setSessionsLoading(true);
    try {
      const result = await api.getChatSessions(walletAddr);
      setSessions(result.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [walletAddr]);

  const openSessionList = () => {
    setShowSessions(true);
    fetchSessions();
  };

  const selectSession = (sessionId: string) => {
    setShowSessions(false);
    setCurrentChatId(sessionId);
  };

  const startNewChat = () => {
    setShowSessions(false);
    setCurrentChatId('new-' + Date.now()); // unique key to force reset
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // ── Session List View ──
  if (showSessions) {
    return (
      <View style={[styles.container, { backgroundColor: colors.systemBackground }]}>
        <View style={[styles.sessionsHeader, { backgroundColor: colors.secondarySystemBackground, borderBottomColor: colors.separator }]}>
          <TouchableOpacity onPress={() => setShowSessions(false)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.tint} />
          </TouchableOpacity>
          <Text style={[styles.sessionsTitle, { color: colors.label }]}>Conversations</Text>
          <View style={{ width: 36 }} />
        </View>

        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: colors.tint }]}
          onPress={startNewChat}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.newChatBtnText}>New Conversation</Text>
        </TouchableOpacity>

        {sessionsLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.tertiaryLabel} />
            <Text style={[typography.body, { color: colors.tertiaryLabel, marginTop: 12 }]}>
              No conversations yet
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.sessionId}
            refreshControl={
              <RefreshControl refreshing={sessionsLoading} onRefresh={fetchSessions} tintColor={colors.tint} />
            }
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.sessionRow, { borderBottomColor: colors.separator }]}
                onPress={() => selectSession(item.sessionId)}
              >
                <View style={styles.sessionInfo}>
                  <View style={styles.sessionTopRow}>
                    <View style={[styles.sessionPhaseBadge, {
                      backgroundColor: item.phase === 'completed' ? colors.systemGreen + '22' : colors.tint + '22',
                    }]}>
                      <Text style={[styles.sessionPhaseText, {
                        color: item.phase === 'completed' ? colors.systemGreen : colors.tint,
                      }]}>
                        {PHASE_LABELS[item.phase] || item.phase}
                      </Text>
                    </View>
                    <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>
                      {formatTime(item.updatedAt)}
                    </Text>
                  </View>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>
                    {item.sessionId.slice(0, 8)}...
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.tertiaryLabel} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── Chat View ──
  const renderMessage = (item: Message) => {
    const isUser = item.role === 'user';
    const hasBlocks = item.blocks && item.blocks.length > 0;

    if (isUser) {
      return (
        <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: colors.tint }]}>
          <Text style={[typography.body, { color: '#FFFFFF' }]}>{item.text}</Text>
          <Text style={[typography.caption2, { color: 'rgba(255,255,255,0.6)', alignSelf: 'flex-end', marginTop: 4 }]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    }

    if (hasBlocks) {
      return (
        <View style={[styles.bubble, styles.bubbleAgent, styles.blocksBubble, { backgroundColor: colors.secondarySystemBackground }]}>
          {item.blocks!.map((block) => {
            const isText = block.type === 'text';
            const blockContent = (
              <BlockRenderer
                block={block}
                isStreaming={isText ? streamingBlockIds.has(block.id) : undefined}
                onAction={handleActionWithContext}
                onFormSubmit={handleFormSubmit}
                onCriteriaChange={handleCriteriaChange}
                onTagsChange={handleTagsChange}
              />
            );
            return (
              <View key={block.id} style={styles.blockWrapper}>
                {isText ? blockContent : <AnimatedBlock>{blockContent}</AnimatedBlock>}
              </View>
            );
          })}
          <Text style={[typography.caption2, { color: colors.tertiaryLabel, alignSelf: 'flex-end', marginTop: 4 }]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    }

    if (!item.text) return null;

    return (
      <View style={[styles.bubble, styles.bubbleAgent, { backgroundColor: colors.secondarySystemBackground }]}>
        <Text style={[typography.body, { color: colors.label }]}>{item.text}</Text>
        <Text style={[typography.caption2, { color: colors.tertiaryLabel, alignSelf: 'flex-end', marginTop: 4 }]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.systemBackground }]}>
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
      {/* Phase indicator with sessions button */}
      <View style={[styles.phaseBar, { backgroundColor: colors.secondarySystemBackground, borderBottomColor: colors.separator }]}>
        <TouchableOpacity onPress={openSessionList} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={20} color={colors.tint} />
        </TouchableOpacity>
        <View style={[styles.phaseDot, { backgroundColor: phase === 'completed' ? colors.systemGreen : colors.tint }]} />
        <Text style={[typography.footnote, { color: colors.secondaryLabel, flex: 1 }]}>
          {PHASE_LABELS[phase] || phase}
        </Text>
        {connectionError && (
          <Text style={[typography.caption2, { color: colors.destructive }]}>{connectionError}</Text>
        )}
        <TouchableOpacity onPress={startNewChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="create-outline" size={20} color={colors.tint} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((item) => (
          <View key={item.id}>{renderMessage(item)}</View>
        ))}
      </ScrollView>

      {/* Typing indicator */}
      {agentTyping && (
        <View style={styles.typingRow}>
          <View style={[styles.typingDot, { backgroundColor: colors.tint, opacity: 0.6 }]} />
          <View style={[styles.typingDot, { backgroundColor: colors.tint, opacity: 0.4 }]} />
          <View style={[styles.typingDot, { backgroundColor: colors.tint, opacity: 0.2 }]} />
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginLeft: 4 }]}>
            Butler is thinking...
          </Text>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { backgroundColor: colors.tertiarySystemBackground, borderTopColor: colors.separator }]}>
        <TextInput
          style={[typography.body, styles.input, { backgroundColor: colors.secondarySystemBackground, color: colors.label, borderColor: colors.separator }]}
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
          style={[styles.sendBtn, { backgroundColor: colors.tint, opacity: input.trim() && walletReady ? 1 : 0.4 }]}
          onPress={sendTextMessage}
          disabled={!input.trim() || !walletReady}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Wallet status */}
      {walletError && (
        <View style={[styles.walletBar, { backgroundColor: colors.destructive + '22' }]}>
          <Ionicons name="warning-outline" size={14} color={colors.destructive} />
          <Text style={[typography.caption2, { color: colors.destructive, marginLeft: 6, flex: 1 }]}>
            Wallet error: {walletError}
          </Text>
          <TouchableOpacity onPress={retryWallet}>
            <Text style={[typography.caption2, { color: colors.tint, fontWeight: '600' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!walletReady && !walletError && (
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
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sessions list
  sessionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionsTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  newChatBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionPhaseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sessionPhaseText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Chat view
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
