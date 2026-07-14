const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error([error.error || error.message || `API Error ${res.status}`, error.hint].filter(Boolean).join("\n"));
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Public APIs ──────────────────────────────

export const api = {
  // Market
  getMarketOverview: () =>
    apiFetch<any>("/api/market/overview"),

  getIndustries: () =>
    apiFetch<any[]>("/api/market/industries"),

  getDataHealth: () =>
    apiFetch<any>("/api/market/data-health"),

  getRealtimeQuotes: (symbols: string[]) => {
    if (!symbols || symbols.length === 0) return Promise.resolve({});
    return apiFetch<Record<string, { price: number; change: number; changePercent: number; timestamp: number }>>(
      `/api/market/quotes?symbols=${symbols.join(",")}`
    );
  },

  // Recommendations
  getRecommendations: (params?: {
    category?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return apiFetch<any>(`/api/recommendations${qs ? `?${qs}` : ""}`);
  },

  getRecommendationsSummary: () =>
    apiFetch<any>("/api/recommendations/summary"),

  getRecommendationBacktest: (params?: {
    category?: string;
    horizon?: number;
    from?: string;
    to?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.horizon) query.set("horizon", String(params.horizon));
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    return apiFetch<any>(`/api/recommendations/backtest${qs ? `?${qs}` : ""}`);
  },

  // Stocks
  searchStocks: (q: string) =>
    apiFetch<any[]>(`/api/stocks/search?q=${encodeURIComponent(q)}`),

  getStockOverview: (symbol: string) =>
    apiFetch<any>(`/api/stocks/${symbol}/overview`),

  getStockChart: (symbol: string, days?: number) =>
    apiFetch<any>(`/api/stocks/${symbol}/chart${days ? `?days=${days}` : ""}`),

  getStockAnalysis: (symbol: string) =>
    apiFetch<any>(`/api/stocks/${symbol}/analysis`),

  // Auth
  login: (email: string, password: string) =>
    apiFetch<any>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, displayName?: string) =>
    apiFetch<any>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),

  getMe: (token: string) =>
    apiFetch<any>("/api/auth/me", { token }),

  updateMe: (data: { displayName?: string }, token: string) =>
    apiFetch<any>("/api/auth/me", {
      method: "PATCH",
      token,
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }, token: string) =>
    apiFetch<any>("/api/auth/change-password", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  // Watchlists (auth required)
  getWatchlists: (token: string) =>
    apiFetch<any[]>("/api/watchlists", { token }),

  getWatchlist: (id: string, token: string) =>
    apiFetch<any>(`/api/watchlists/${id}`, { token }),

  createWatchlist: (name: string, token: string, description?: string) =>
    apiFetch<any>("/api/watchlists", {
      method: "POST",
      token,
      body: JSON.stringify({ name, description }),
    }),

  updateWatchlist: (id: string, name: string, token: string, description?: string) =>
    apiFetch<any>(`/api/watchlists/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ name, description }),
    }),

  deleteWatchlist: (id: string, token: string) =>
    apiFetch<any>(`/api/watchlists/${id}`, {
      method: "DELETE",
      token,
    }),

  addToWatchlist: (
    watchlistId: string,
    symbol: string,
    token: string,
    options?: { addedReason?: string; note?: string; tags?: string[] }
  ) =>
    apiFetch<any>(`/api/watchlists/${watchlistId}/items`, {
      method: "POST",
      token,
      body: JSON.stringify({ symbol, ...options }),
    }),

  removeFromWatchlist: (watchlistId: string, itemId: string, token: string) =>
    apiFetch<any>(`/api/watchlists/${watchlistId}/items/${itemId}`, {
      method: "DELETE",
      token,
    }),

  // Screener
  runScreener: (filters: Record<string, unknown>) =>
    apiFetch<any>("/api/screener", {
      method: "POST",
      body: JSON.stringify(filters),
    }),

  // Alerts
  getAlertRules: (token: string) =>
    apiFetch<any[]>("/api/alerts/rules", { token }),

  createAlertRule: (rule: { symbol: string; conditionType: string; threshold?: number }, token: string) =>
    apiFetch<any>("/api/alerts/rules", {
      method: "POST",
      token,
      body: JSON.stringify(rule),
    }),

  toggleAlertRule: (ruleId: string, isActive: boolean, token: string) =>
    apiFetch<any>(`/api/alerts/rules/${ruleId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ isActive }),
    }),

  deleteAlertRule: (ruleId: string, token: string) =>
    apiFetch<any>(`/api/alerts/rules/${ruleId}`, {
      method: "DELETE",
      token,
    }),

  getAlertEvents: (token: string, unreadOnly?: boolean) =>
    apiFetch<any>(`/api/alerts/events${unreadOnly ? "?unreadOnly=true" : ""}`, { token }),

  markEventAsRead: (eventId: string, token: string) =>
    apiFetch<any>(`/api/alerts/events/${eventId}/read`, {
      method: "PATCH",
      token,
    }),

  markAllEventsAsRead: (token: string) =>
    apiFetch<any>("/api/alerts/events/read-all", {
      method: "POST",
      token,
    }),

  // Notification channels
  getNotificationChannels: (token: string) =>
    apiFetch<any[]>("/api/notification-channels", { token }),

  saveNotificationChannel: (
    channel: { type: "LINE" | "TELEGRAM"; name: string; isActive?: boolean; config: Record<string, unknown> },
    token: string
  ) =>
    apiFetch<any>("/api/notification-channels", {
      method: "PUT",
      token,
      body: JSON.stringify(channel),
    }),

  testNotificationChannel: (
    payload: { channelId?: string; type?: "LINE" | "TELEGRAM"; config?: Record<string, unknown>; message?: string },
    token: string
  ) =>
    apiFetch<any>("/api/notification-channels/test", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    }),

  updateNotificationChannel: (id: string, isActive: boolean, token: string) =>
    apiFetch<any>(`/api/notification-channels/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ isActive }),
    }),

  deleteNotificationChannel: (id: string, token: string) =>
    apiFetch<void>(`/api/notification-channels/${id}`, { method: "DELETE", token }),

  // AI stock analysis
  getAiProviders: (token: string) =>
    apiFetch<Array<{ id: string; label: string; model: string; isDefault: boolean }>>("/api/ai/providers", { token }),

  generateAiAnalysis: (symbol: string, payload: { providerId?: string; forceRefresh?: boolean }, token: string) =>
    apiFetch<any>(`/api/ai/stocks/${symbol}/analysis`, {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    }),

  getAiConversation: (conversationId: string, token: string) =>
    apiFetch<any>(`/api/ai/conversations/${conversationId}`, { token }),

  sendAiMessage: (conversationId: string, content: string, token: string) =>
    apiFetch<any>(`/api/ai/conversations/${conversationId}/messages`, {
      method: "POST",
      token,
      body: JSON.stringify({ content }),
    }),

  deleteAiConversation: (conversationId: string, token: string) =>
    apiFetch<void>(`/api/ai/conversations/${conversationId}`, { method: "DELETE", token }),

  // Portfolio
  getHoldings: (token: string) =>
    apiFetch<any[]>("/api/portfolio/holdings", { token }),

  getPortfolioSummary: (token: string) =>
    apiFetch<any>("/api/portfolio/summary", { token }),

  saveHolding: (
    holding: {
      symbol: string;
      shares: number;
      averageCost: number;
      targetPrice?: number;
      stopLoss?: number;
      note?: string;
    },
    token: string
  ) =>
    apiFetch<any>("/api/portfolio/holdings", {
      method: "POST",
      token,
      body: JSON.stringify(holding),
    }),

  updateHolding: (
    id: string,
    holding: {
      shares?: number;
      averageCost?: number;
      targetPrice?: number;
      stopLoss?: number;
      note?: string;
    },
    token: string
  ) =>
    apiFetch<any>(`/api/portfolio/holdings/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(holding),
    }),

  deleteHolding: (id: string, token: string) =>
    apiFetch<any>(`/api/portfolio/holdings/${id}`, {
      method: "DELETE",
      token,
    }),
};
