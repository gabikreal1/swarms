import {
  USE_MOCKS,
  mockDelay,
  MOCK_JOBS,
  MOCK_ANALYSIS,
  MOCK_TAG_SUGGESTIONS,
} from '../config/mock';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Job pipeline
export const api = {
  analyzeJob: async (query: string, sessionId?: string, walletAddress?: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return MOCK_ANALYSIS;
    }
    const res = await request<{ data: any }>('/v1/jobs/analyze', {
      method: 'POST',
      body: JSON.stringify({ query, sessionId, walletAddress }),
    });
    return res.data;
  },

  suggestCriteria: (slots: any) =>
    request('/v1/jobs/suggest-criteria', {
      method: 'POST',
      body: JSON.stringify({ slots }),
    }),

  finalizeJob: async (data: any) => {
    if (USE_MOCKS) {
      await mockDelay();
      return {
        unsignedTx: { to: '0x0000000000000000000000000000000000000000', data: '0x', value: '0' },
      };
    }
    const res = await request<{ data: any }>('/v1/jobs/finalize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  getDraft: (sessionId: string) =>
    request(`/v1/jobs/draft/${sessionId}`),

  // Taxonomy
  getTaxonomyTree: (params?: { category?: string; includeStats?: boolean }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request(`/v1/taxonomy/tree${qs ? '?' + qs : ''}`);
  },

  suggestTags: async (q: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return MOCK_TAG_SUGGESTIONS.filter(
        (t) => t.tag.includes(q.toLowerCase()) || t.categoryPath.toLowerCase().includes(q.toLowerCase()),
      );
    }
    return request(`/v1/taxonomy/suggest?q=${encodeURIComponent(q)}`);
  },

  // Feed
  getJobFeed: async (params?: Record<string, string>) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { jobs: MOCK_JOBS };
    }
    const qs = params ? new URLSearchParams(params).toString() : '';
    const res = await request<{ data: any[] }>(`/v1/feed/jobs${qs ? '?' + qs : ''}`);
    const jobs = (res.data || []).map((j: any) => ({
      ...j,
      status: j.status ? j.status.toLowerCase() : 'open',
    }));
    return { jobs };
  },

  getJob: async (id: string | number) => {
    if (USE_MOCKS) {
      await mockDelay();
      return MOCK_JOBS.find((j) => String(j.id) === String(id)) || null;
    }
    const res = await request<{ data: any }>(`/v1/feed/jobs/${id}`);
    const job = res.data || null;
    if (job && job.status) {
      job.status = job.status.toLowerCase();
    }
    return job;
  },

  getRecommendedJobs: (agentAddress: string, strategy?: string) => {
    const qs = new URLSearchParams({ agent_address: agentAddress, ...(strategy && { strategy }) }).toString();
    return request(`/v1/feed/jobs/recommended?${qs}`);
  },

  // Butler Chat
  chatMessage: (body: {
    sessionId?: string;
    walletAddress: string;
    message?: string;
    formResponse?: { formId: string; values: Record<string, string> };
    actionResponse?: { actionId: string; toolCall?: string; toolArgs?: Record<string, unknown> };
    criteriaResponse?: { selectedIds: string[]; customCriteria?: string[] };
    tagsResponse?: { selectedTags: string[] };
  }) =>
    request<{
      sessionId: string;
      message: {
        id: string;
        role: 'butler';
        blocks: any[];
        timestamp: string;
        metadata?: { sessionPhase?: string };
      };
      phase: string;
    }>('/v1/chat/message', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getChatSession: (sessionId: string) =>
    request<{
      sessionId: string;
      phase: string;
      messages: any[];
      context: any;
    }>(`/v1/chat/${sessionId}`),

  getChatSessions: (walletAddress: string) =>
    request<{ sessions: { sessionId: string; phase: string; createdAt: string; updatedAt: string }[] }>(
      `/v1/chat/sessions?wallet=${encodeURIComponent(walletAddress)}`,
    ),
};
