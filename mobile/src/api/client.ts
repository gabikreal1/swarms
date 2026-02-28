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
  analyzeJob: (query: string, sessionId?: string, walletAddress?: string) =>
    request('/jobs/analyze', {
      method: 'POST',
      body: JSON.stringify({ query, sessionId, walletAddress }),
    }),

  suggestCriteria: (slots: any) =>
    request('/jobs/suggest-criteria', {
      method: 'POST',
      body: JSON.stringify({ slots }),
    }),

  finalizeJob: (data: any) =>
    request('/jobs/finalize', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDraft: (sessionId: string) =>
    request(`/jobs/draft/${sessionId}`),

  // Taxonomy
  getTaxonomyTree: (params?: { category?: string; includeStats?: boolean }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request(`/v1/taxonomy/tree${qs ? '?' + qs : ''}`);
  },

  suggestTags: (q: string) =>
    request(`/v1/taxonomy/suggest?q=${encodeURIComponent(q)}`),

  // Feed
  getJobFeed: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/v1/feed/jobs${qs ? '?' + qs : ''}`);
  },

  getRecommendedJobs: (agentAddress: string, strategy?: string) => {
    const qs = new URLSearchParams({ agent_address: agentAddress, ...(strategy && { strategy }) }).toString();
    return request(`/v1/feed/jobs/recommended?${qs}`);
  },
};
