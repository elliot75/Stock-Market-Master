import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptNotificationConfig,
  encryptNotificationConfig,
  mergeNotificationConfig,
  testNotification,
} from "./index.js";

describe("notification configuration", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    vi.restoreAllMocks();
  });

  it("encrypts settings and preserves a configured Telegram token on blank updates", () => {
    const encrypted = encryptNotificationConfig({ botToken: "token", chatId: "123" });
    expect(decryptNotificationConfig(encrypted)).toEqual({ botToken: "token", chatId: "123" });
    expect(mergeNotificationConfig({ type: "TELEGRAM", existing: encrypted, next: { botToken: "", chatId: "456" } })).toEqual({ botToken: "token", chatId: "456" });
  });

  it("validates Telegram before sending a test message and uses chat_id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 })));
    const result = await testNotification({ type: "TELEGRAM", config: { botToken: "token", chatId: "-1001" } }, "hello");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/sendMessage");
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({ chat_id: "-1001", text: "hello" });
  });
});
