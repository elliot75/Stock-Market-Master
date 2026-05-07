const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
    throw new Error(error.error || error.message || `API Error ${res.status}`);
  }

  return res.json();
}

// ─── Public APIs ──────────────────────────────

export const api = {
  // Market
  getMarketOverview: () =>
    apiFetch<any>("/api/market/overview"),

  getIndustries: () =>
    apiFetch<any[]>("/api/market/industries"),

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
};
