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

  suggestTags: (q: string) =>
    request(`/v1/taxonomy/suggest?q=${encodeURIComponent(q)}`),

  // Feed
  getJobFeed: async (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    const res = await request<{ data: any[] }>(`/v1/feed/jobs${qs ? '?' + qs : ''}`);
    const jobs = (res.data || []).map((j: any) => ({
      ...j,
      status: j.status ? j.status.toLowerCase() : 'open',
    }));
    return { jobs };
  },

  getJob: async (id: string | number) => {
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

  // Agents
  getAgents: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return request<{ data: any[]; nextCursor: string | null; total: number }>(`/v1/feed/agents${qs ? '?' + qs : ''}`);
  },

  // Bids
  rejectBid: (bidId: string) =>
    request<{ ok: boolean }>(`/v1/feed/bids/${bidId}/reject`, { method: 'POST' }),

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
