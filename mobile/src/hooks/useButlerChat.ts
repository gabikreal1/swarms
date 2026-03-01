import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, FlatList } from 'react-native';
import { api, API_BASE } from '../api/client';
import { initWallet } from '../wallet/circle';

export interface GenUIBlock {
  id: string;
  type: string;
  [key: string]: any;
}

export interface Message {
  id: string;
  role: 'user' | 'butler';
  text: string;
  timestamp: number;
  blocks?: GenUIBlock[];
}

export const PHASE_LABELS: Record<string, string> = {
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

export function useButlerChat(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [streamingBlockIds, setStreamingBlockIds] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>('greeting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [walletReady, setWalletReady] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const eventSourceRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const initialFetchDone = useRef(false);
  const MAX_RETRIES = 5;

  const criteriaRef = useRef<{
    selectedIds: string[];
    customCriteria?: string[];
  } | null>(null);

  const tagsRef = useRef<string[]>([]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Initialize wallet
  const tryInitWallet = useCallback(async () => {
    setWalletReady(false);
    setWalletError(null);
    try {
      console.log('[wallet] initializing...');
      const w = await initWallet();
      console.log('[wallet] ready:', w.address);
      setWalletAddress(w.address);
      setWalletReady(true);
    } catch (e: any) {
      const msg = e?.message || 'Unknown wallet error';
      console.error('[wallet] init failed:', msg, e);
      setWalletError(msg);
      setWalletReady(true); // mark ready so UI doesn't hang on spinner
    }
  }, []);

  useEffect(() => {
    tryInitWallet();
  }, [tryInitWallet]);

  // Load initial data — waits for walletAddress before calling the API
  useEffect(() => {
    // Wait for wallet before making API calls
    if (!walletAddress) return;

    // Only fetch once per mount
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    if (!chatId || chatId === 'new') {
      sendToButler({ message: '' });
      return;
    }

    loadSession(chatId);
  }, [chatId, walletAddress]);

  // Connect SSE when sessionId is available
  useEffect(() => {
    if (!sessionId) return;

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
              if (data.blockType === 'text') {
                setStreamingBlockIds(prev => new Set(prev).add(data.blockId));
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'butler') {
                    const blocks = last.blocks || [];
                    return [
                      ...prev.slice(0, -1),
                      { ...last, blocks: [...blocks, { id: data.blockId, type: 'text', content: '' }] },
                    ];
                  }
                  return [
                    ...prev,
                    {
                      id: `butler-${Date.now()}`,
                      role: 'butler' as const,
                      text: '',
                      timestamp: Date.now(),
                      blocks: [{ id: data.blockId, type: 'text', content: '' }],
                    },
                  ];
                });
              }
              break;

            case 'block_delta':
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
              setStreamingBlockIds(prev => {
                const next = new Set(prev);
                next.delete(data.blockId);
                return next;
              });
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
    if (!walletAddress) {
      Alert.alert('Wallet Not Ready', 'Please wait for the wallet to connect before sending messages.');
      return;
    }

    setAgentTyping(true);

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

      if (!sessionId) {
        setSessionId(result.sessionId);
      }

      setPhase(result.phase);

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
    criteriaRef.current = { selectedIds, customCriteria };
  };

  const handleTagsChange = (selectedTags: string[]) => {
    tagsRef.current = selectedTags;
  };

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

  return {
    messages,
    input,
    setInput,
    loading,
    agentTyping,
    phase,
    connectionError,
    walletReady,
    walletError,
    retryWallet: tryInitWallet,
    flatListRef,
    scrollToEnd,
    sendTextMessage,
    handleActionWithContext,
    handleFormSubmit,
    handleCriteriaChange,
    handleTagsChange,
    streamingBlockIds,
  };
}
