import type { NotificationChannel } from "@repo/database";

interface SendResult {
  ok: boolean;
  responseJson?: unknown;
  errorMessage?: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function maskNotificationConfig(channel: NotificationChannel) {
  const config = asObject(channel.config);
  if (channel.type === "LINE") {
    return {
      userId: typeof config.userId === "string" ? config.userId : undefined,
      channelAccessToken: config.channelAccessToken ? "********" : undefined,
    };
  }

  return {
    chatId: typeof config.chatId === "string" ? config.chatId : undefined,
    botToken: config.botToken ? "********" : undefined,
  };
}

export async function sendNotification(
  channel: { type: NotificationChannel["type"]; config: unknown },
  message: string
): Promise<SendResult> {
  const config = asObject(channel.config);

  if (channel.type === "LINE") {
    const channelAccessToken =
      typeof config.channelAccessToken === "string" ? config.channelAccessToken : "";
    const userId = typeof config.userId === "string" ? config.userId : "";
    if (!channelAccessToken || !userId) {
      return { ok: false, errorMessage: "LINE channelAccessToken/userId 未設定" };
    }

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text: message }],
      }),
    });
    const responseJson = await response.json().catch(() => null);
    return response.ok
      ? { ok: true, responseJson }
      : { ok: false, responseJson, errorMessage: `LINE API ${response.status}` };
  }

  const botToken = typeof config.botToken === "string" ? config.botToken : "";
  const chatId = typeof config.chatId === "string" ? config.chatId : "";
  if (!botToken || !chatId) {
    return { ok: false, errorMessage: "Telegram botToken/chatId 未設定" };
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  const responseJson = await response.json().catch(() => null);
  return response.ok
    ? { ok: true, responseJson }
    : { ok: false, responseJson, errorMessage: `Telegram API ${response.status}` };
}
