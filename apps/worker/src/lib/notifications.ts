import {
  prisma,
  type NotificationChannel,
  type NotificationChannelType,
} from "@repo/database";

interface LineConfig {
  channelAccessToken?: string;
  userId?: string;
}

interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

interface SendResult {
  ok: boolean;
  responseJson?: unknown;
  errorMessage?: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getChannelConfig(channel: NotificationChannel): LineConfig | TelegramConfig {
  const config = asObject(channel.config);
  if (channel.type === "LINE") {
    return {
      channelAccessToken: typeof config.channelAccessToken === "string" ? config.channelAccessToken : undefined,
      userId: typeof config.userId === "string" ? config.userId : undefined,
    };
  }

  return {
    botToken: typeof config.botToken === "string" ? config.botToken : undefined,
    chatId: typeof config.chatId === "string" ? config.chatId : undefined,
  };
}

export async function sendNotification(
  channel: NotificationChannel,
  message: string
): Promise<SendResult> {
  if (channel.type === "LINE") {
    const config = getChannelConfig(channel) as LineConfig;
    if (!config.channelAccessToken || !config.userId) {
      return { ok: false, errorMessage: "LINE channelAccessToken/userId 未設定" };
    }

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: config.userId,
        messages: [{ type: "text", text: message }],
      }),
    });
    const responseJson = await response.json().catch(() => null);
    return response.ok
      ? { ok: true, responseJson }
      : { ok: false, responseJson, errorMessage: `LINE API ${response.status}` };
  }

  const config = getChannelConfig(channel) as TelegramConfig;
  if (!config.botToken || !config.chatId) {
    return { ok: false, errorMessage: "Telegram botToken/chatId 未設定" };
  }

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.chatId, text: message }),
  });
  const responseJson = await response.json().catch(() => null);
  return response.ok
    ? { ok: true, responseJson }
    : { ok: false, responseJson, errorMessage: `Telegram API ${response.status}` };
}

export async function dispatchAlertNotifications(params: {
  eventId: string;
  userId: string;
  message: string;
}) {
  const channels = await prisma.notificationChannel.findMany({
    where: { userId: params.userId, isActive: true },
  });

  for (const channel of channels) {
    let result: SendResult;
    try {
      result = await sendNotification(channel, params.message);
    } catch (error) {
      result = {
        ok: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    await prisma.alertDeliveryAttempt.create({
      data: {
        eventId: params.eventId,
        channelId: channel.id,
        channelType: channel.type as NotificationChannelType,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.errorMessage,
        responseJson: result.responseJson == null ? undefined : result.responseJson,
      },
    });
  }
}
