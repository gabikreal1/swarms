import {
  USE_MOCKS,
  mockDelay,
  MOCK_JOBS,
  MOCK_ANALYSIS,
  MOCK_TAG_SUGGESTIONS,
} from '../config/mock';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Job pipeline
export const api = {
  analyzeJob: async (query: string, sessionId?: string, walletAddress?: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return MOCK_ANALYSIS;
    }
    return request('/v1/jobs/analyze', {
      method: 'POST',
      body: JSON.stringify({ query, sessionId, walletAddress }),
    });
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
    return request('/v1/jobs/finalize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
    const qs = new URLSearchParams(params).toString();
    return request(`/v1/feed/jobs${qs ? '?' + qs : ''}`);
  },

  getJob: async (id: string | number) => {
    if (USE_MOCKS) {
      await mockDelay();
      return MOCK_JOBS.find((j) => String(j.id) === String(id)) || null;
    }
    return request(`/v1/feed/jobs/${id}`);
  },

  getRecommendedJobs: (agentAddress: string, strategy?: string) => {
    const qs = new URLSearchParams({ agent_address: agentAddress, ...(strategy && { strategy }) }).toString();
    return request(`/v1/feed/jobs/recommended?${qs}`);
  },
};
