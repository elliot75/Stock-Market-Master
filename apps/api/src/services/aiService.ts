import { createHash } from "node:crypto";
import { z } from "zod";

export interface LlmProvider {
  id: "custom" | "openai" | "xai" | "gemini";
  label: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
}

const reportSchema = z.object({
  stance: z.enum(["BULLISH", "NEUTRAL", "BEARISH"]),
  confidence: z.number().min(0).max(100),
  summary: z.string().min(1).max(1200),
  technicalView: z.string().min(1).max(1200),
  fundamentalView: z.string().min(1).max(1200),
  chipView: z.string().min(1).max(1200),
  strengths: z.array(z.string().min(1).max(300)).max(6),
  risks: z.array(z.string().min(1).max(300)).max(6),
  keyLevels: z.object({
    support: z.number().nullable(),
    resistance: z.number().nullable(),
    stopLoss: z.number().nullable(),
  }),
  scenarios: z.array(z.object({ title: z.string().max(120), detail: z.string().max(500) })).max(4),
  dataLimitations: z.array(z.string().min(1).max(300)).max(6),
});

export type AiReport = z.infer<typeof reportSchema>;

function normalizeBaseUrl(value: string) {
  const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return withScheme.replace(/\/$/, "");
}

function configuredProvider(params: {
  id: LlmProvider["id"];
  label: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  defaultBaseUrl: string;
  keyRequired?: boolean;
}): LlmProvider | null {
  if (!params.model || (params.keyRequired !== false && !params.apiKey)) return null;
  return {
    id: params.id,
    label: params.label,
    model: params.model,
    apiKey: params.apiKey || undefined,
    baseUrl: normalizeBaseUrl(params.baseUrl || params.defaultBaseUrl),
  };
}

export function getLlmProviders(): LlmProvider[] {
  return [
    configuredProvider({
      id: "custom", label: "自訂 LLM", model: process.env.LLM_MODEL,
      apiKey: process.env.LLM_API_KEY, baseUrl: process.env.LLM_BASE_URL,
      defaultBaseUrl: "http://localhost:11434/v1", keyRequired: false,
    }),
    configuredProvider({
      id: "openai", label: "OpenAI", model: process.env.OPENAI_MODEL,
      apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL,
      defaultBaseUrl: "https://api.openai.com/v1",
    }),
    configuredProvider({
      id: "xai", label: "xAI Grok", model: process.env.XAI_MODEL,
      apiKey: process.env.XAI_API_KEY, baseUrl: process.env.XAI_BASE_URL,
      defaultBaseUrl: "https://api.x.ai/v1",
    }),
    configuredProvider({
      id: "gemini", label: "Google Gemini", model: process.env.GEMINI_MODEL,
      apiKey: process.env.GEMINI_API_KEY, baseUrl: process.env.GEMINI_BASE_URL,
      defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    }),
  ].filter((provider): provider is LlmProvider => provider !== null);
}

export function getLlmProvider(id?: string) {
  const providers = getLlmProviders();
  const requested = id || process.env.LLM_DEFAULT_PROVIDER;
  return providers.find((provider) => provider.id === requested) || providers[0] || null;
}

export function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function endpoint(baseUrl: string) {
  return baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
}

function timeoutMs() {
  const value = Number.parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10);
  return Number.isFinite(value) ? Math.max(5_000, Math.min(value, 180_000)) : 60_000;
}

export async function complete(params: {
  provider: LlmProvider;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}) {
  const response = await fetch(endpoint(params.provider.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(params.provider.apiKey ? { Authorization: `Bearer ${params.provider.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: params.provider.model, messages: params.messages }),
    signal: AbortSignal.timeout(timeoutMs()),
  });
  const body = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: unknown;
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message || `LLM API ${response.status}`);
  }
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 未回傳文字內容");
  return { content, usage: body?.usage };
}

function extractJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse((fenced || value).trim());
}

export async function createReport(provider: LlmProvider, context: unknown) {
  const system = [
    "你是台股資料分析助理。僅能根據使用者提供的 JSON 資料分析，不可捏造新聞、即時行情或財務數字。",
    "不可提供保證獲利、個人化投資指令或自動交易建議。資料不足時明確說明。",
    "請只輸出 JSON，符合欄位：stance(BULLISH|NEUTRAL|BEARISH)、confidence(0-100)、summary、technicalView、fundamentalView、chipView、strengths(string[])、risks(string[])、keyLevels({support,resistance,stopLoss})、scenarios([{title,detail}])、dataLimitations(string[])。",
  ].join("\n");
  let result = await complete({ provider, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(context) }] });
  try {
    return { report: reportSchema.parse(extractJson(result.content)), usage: result.usage };
  } catch {
    result = await complete({
      provider,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(context) },
        { role: "assistant", content: result.content },
        { role: "user", content: "上一則輸出無法驗證。請只回傳符合指定欄位的有效 JSON，不要 Markdown。" },
      ],
    });
    return { report: reportSchema.parse(extractJson(result.content)), usage: result.usage };
  }
}
