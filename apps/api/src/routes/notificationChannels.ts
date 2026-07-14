import type { FastifyInstance } from "fastify";
import { prisma, Prisma } from "@repo/database";
import { z } from "zod";
import {
  encryptNotificationConfig,
  maskNotificationConfig,
  mergeNotificationConfig,
  testNotification,
} from "../services/notificationService.js";

const channelSchema = z.object({
  type: z.enum(["LINE", "TELEGRAM"]),
  name: z.string().min(1).max(80),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).default({}),
});

const testSchema = z.object({
  channelId: z.string().optional(),
  type: z.enum(["LINE", "TELEGRAM"]).optional(),
  config: z.record(z.unknown()).optional(),
  message: z.string().min(1).max(500).optional(),
});

function publicChannel(channel: { id: string; type: "LINE" | "TELEGRAM"; name: string; isActive: boolean; lastTestedAt: Date | null; createdAt?: Date; updatedAt?: Date; config: unknown }) {
  return {
    id: channel.id,
    type: channel.type,
    name: channel.name,
    isActive: channel.isActive,
    lastTestedAt: channel.lastTestedAt,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    config: maskNotificationConfig(channel),
  };
}

export async function notificationChannelRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const userId = request.userId as string;
    const channels = await prisma.notificationChannel.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });
    return channels.map((channel) => publicChannel(channel));
  });

  app.put("/", async (request, reply) => {
    const userId = request.userId as string;
    const body = channelSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Validation Error", details: body.error.flatten().fieldErrors });
    }

    const existing = await prisma.notificationChannel.findUnique({
      where: { userId_type: { userId, type: body.data.type } },
    });
    let config: Record<string, unknown>;
    try {
      config = mergeNotificationConfig({ type: body.data.type, existing: existing?.config, next: body.data.config });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "通知設定無效" });
    }

    let encryptedConfig: Prisma.InputJsonValue;
    try {
      encryptedConfig = encryptNotificationConfig(config) as unknown as Prisma.InputJsonValue;
    } catch (error) {
      return reply.code(503).send({ error: error instanceof Error ? error.message : "通知加密服務未設定" });
    }
    const data = { name: body.data.name, isActive: body.data.isActive ?? existing?.isActive ?? true, config: encryptedConfig };
    const channel = existing
      ? await prisma.notificationChannel.update({ where: { id: existing.id }, data })
      : await prisma.notificationChannel.create({ data: { userId, type: body.data.type, ...data } });
    return publicChannel(channel);
  });

  app.patch("/:channelId", async (request, reply) => {
    const userId = request.userId as string;
    const { channelId } = request.params as { channelId: string };
    const body = z.object({ isActive: z.boolean() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "isActive 必須為 boolean" });
    const channel = await prisma.notificationChannel.findFirst({ where: { id: channelId, userId } });
    if (!channel) return reply.code(404).send({ error: "通知渠道不存在" });
    return publicChannel(await prisma.notificationChannel.update({ where: { id: channel.id }, data: body.data }));
  });

  app.delete("/:channelId", async (request, reply) => {
    const userId = request.userId as string;
    const { channelId } = request.params as { channelId: string };
    const channel = await prisma.notificationChannel.findFirst({ where: { id: channelId, userId }, select: { id: true } });
    if (!channel) return reply.code(404).send({ error: "通知渠道不存在" });
    await prisma.notificationChannel.delete({ where: { id: channel.id } });
    return reply.code(204).send();
  });

  app.post("/test", async (request, reply) => {
    const userId = request.userId as string;
    const body = testSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Validation Error", details: body.error.flatten().fieldErrors });

    const message = body.data.message || "台股分析大師通知測試";
    const channel = body.data.channelId
      ? await prisma.notificationChannel.findFirst({ where: { id: body.data.channelId, userId } })
      : null;
    const target = channel ?? (body.data.type && body.data.config ? { type: body.data.type, config: body.data.config } : null);
    if (!target) return reply.code(400).send({ error: "請提供 channelId 或 type/config" });

    const result = await testNotification(target, message);
    if (!result.ok) return reply.code(422).send({ error: result.errorMessage || "通知測試失敗", code: result.code, hint: result.hint });
    if (channel) await prisma.notificationChannel.update({ where: { id: channel.id }, data: { lastTestedAt: new Date() } });
    return result;
  });
}
