import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';
import { USE_MOCKS } from '../../src/config/mock';
import { useButlerChat, PHASE_LABELS, Message } from '../../src/hooks/useButlerChat';
import BlockRenderer from '../../src/components/genui/BlockRenderer';
import AnimatedBlock from '../../src/components/genui/AnimatedBlock';

export default function ButlerTab() {
  const { colors, typography } = useTheme();
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
  } = useButlerChat('new');

  const renderMessage = (item: Message) => {
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
      {!USE_MOCKS && walletError && (
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
      {!USE_MOCKS && !walletReady && !walletError && (
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
