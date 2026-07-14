import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type NotificationChannelType = "LINE" | "TELEGRAM";

export interface NotificationChannelInput {
  type: NotificationChannelType;
  config: unknown;
}

export interface NotificationResult {
  ok: boolean;
  code?: string;
  errorMessage?: string;
  hint?: string;
  responseJson?: unknown;
}

type Config = Record<string, unknown>;

interface EncryptedConfig {
  v: 1;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

function asObject(value: unknown): Config {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Config)
    : {};
}

function readKey(value = process.env.APP_ENCRYPTION_KEY): Buffer {
  if (!value) throw new Error("APP_ENCRYPTION_KEY 未設定");
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY 必須為 32-byte base64 或 64 字元 hex");
  }
  return key;
}

function isEncryptedConfig(value: unknown): value is EncryptedConfig {
  const config = asObject(value);
  return config.v === 1 && config.alg === "aes-256-gcm" &&
    typeof config.iv === "string" && typeof config.tag === "string" &&
    typeof config.ciphertext === "string";
}

export function encryptNotificationConfig(value: Config): EncryptedConfig {
  const key = readKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptNotificationConfig(value: unknown): Config {
  if (!isEncryptedConfig(value)) return asObject(value);
  const keys = [process.env.APP_ENCRYPTION_KEY, process.env.APP_ENCRYPTION_KEY_PREVIOUS]
    .filter((key): key is string => Boolean(key));
  let lastError: unknown;
  for (const configuredKey of keys) {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        readKey(configuredKey),
        Buffer.from(value.iv, "base64")
      );
      decipher.setAuthTag(Buffer.from(value.tag, "base64"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
      return asObject(JSON.parse(plaintext));
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`通知設定無法解密${lastError ? "，請確認 APP_ENCRYPTION_KEY" : ""}`);
}

export function maskNotificationConfig(channel: NotificationChannelInput) {
  const config = decryptNotificationConfig(channel.config);
  if (channel.type === "LINE") {
    return {
      userId: typeof config.userId === "string" ? config.userId : undefined,
      channelAccessTokenConfigured: Boolean(config.channelAccessToken),
    };
  }
  return {
    chatId: typeof config.chatId === "string" ? config.chatId : undefined,
    botTokenConfigured: Boolean(config.botToken),
  };
}

export function mergeNotificationConfig(params: {
  type: NotificationChannelType;
  existing?: unknown;
  next: unknown;
}): Config {
  const existing = params.existing ? decryptNotificationConfig(params.existing) : {};
  const next = asObject(params.next);
  const keepSecret = (key: string) => {
    const value = next[key];
    return typeof value === "string" && value.trim() && value !== "********"
      ? value.trim()
      : existing[key];
  };
  if (params.type === "TELEGRAM") {
    const botToken = keepSecret("botToken");
    const chatId = typeof next.chatId === "string" && next.chatId.trim()
      ? next.chatId.trim()
      : existing.chatId;
    if (typeof botToken !== "string" || typeof chatId !== "string") {
      throw new Error("Telegram Bot Token 與 Chat ID 為必填欄位");
    }
    return { botToken, chatId };
  }
  const channelAccessToken = keepSecret("channelAccessToken");
  const userId = typeof next.userId === "string" && next.userId.trim()
    ? next.userId.trim()
    : existing.userId;
  if (typeof channelAccessToken !== "string" || typeof userId !== "string") {
    throw new Error("LINE Channel Access Token 與 User ID 為必填欄位");
  }
  return { channelAccessToken, userId };
}

function telegramBaseUrl() {
  return (process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org").replace(/\/$/, "");
}

async function telegramRequest(method: string, body: Config): Promise<NotificationResult> {
  try {
    const payload = Object.fromEntries(
      Object.entries(body)
        .filter(([key]) => key !== "botToken")
        .map(([key, value]) => [key === "chatId" ? "chat_id" : key, value])
    );
    const response = await fetch(`${telegramBaseUrl()}/bot${body.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const responseJson = await response.json().catch(() => null) as { description?: string; error_code?: number } | null;
    if (response.ok && responseJson?.description == null && responseJson != null) {
      return { ok: true, responseJson };
    }
    const description = responseJson?.description || `Telegram API ${response.status}`;
    const hint = /chat not found|bot was blocked|user is deactivated/i.test(description)
      ? "請確認 Chat ID，並先在 Telegram 對 Bot 傳送 /start。"
      : /unauthorized|token/i.test(description)
        ? "Bot Token 無效，請至 BotFather 重新確認。"
        : response.status === 429
          ? "Telegram 暫時限流，請稍後再試。"
          : undefined;
    return { ok: false, code: `TELEGRAM_${responseJson?.error_code || response.status}`, errorMessage: description, hint, responseJson };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: "TELEGRAM_NETWORK", errorMessage: message, hint: "請確認伺服器可連線至 api.telegram.org。" };
  }
}

export async function testNotification(channel: NotificationChannelInput, message: string): Promise<NotificationResult> {
  const config = decryptNotificationConfig(channel.config);
  if (channel.type !== "TELEGRAM") return sendNotification({ type: channel.type, config }, message);
  const auth = await telegramRequest("getMe", config);
  if (!auth.ok) return auth;
  const chat = await telegramRequest("getChat", config);
  if (!chat.ok) return chat;
  return telegramRequest("sendMessage", { ...config, text: message });
}

export async function sendNotification(channel: NotificationChannelInput, message: string): Promise<NotificationResult> {
  const config = decryptNotificationConfig(channel.config);
  if (channel.type === "TELEGRAM") {
    if (typeof config.botToken !== "string" || typeof config.chatId !== "string") {
      return { ok: false, code: "TELEGRAM_CONFIG", errorMessage: "Telegram Bot Token 或 Chat ID 未設定" };
    }
    return telegramRequest("sendMessage", { ...config, text: message });
  }
  const token = typeof config.channelAccessToken === "string" ? config.channelAccessToken : "";
  const userId = typeof config.userId === "string" ? config.userId : "";
  if (!token || !userId) return { ok: false, code: "LINE_CONFIG", errorMessage: "LINE 設定不完整" };
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: userId, messages: [{ type: "text", text: message }] }),
      signal: AbortSignal.timeout(15_000),
    });
    const responseJson = await response.json().catch(() => null);
    return response.ok
      ? { ok: true, responseJson }
      : { ok: false, code: `LINE_${response.status}`, errorMessage: `LINE API ${response.status}`, responseJson };
  } catch (error) {
    return { ok: false, code: "LINE_NETWORK", errorMessage: error instanceof Error ? error.message : String(error) };
  }
}
