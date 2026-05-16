import type { FastifyInstance } from "fastify";
import { prisma, Prisma } from "@repo/database";
import { z } from "zod";
import {
  maskNotificationConfig,
  sendNotification,
} from "../services/notificationService.js";

const channelSchema = z.object({
  type: z.enum(["LINE", "TELEGRAM"]),
  name: z.string().min(1).max(80),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()),
});

const testSchema = z.object({
  channelId: z.string().optional(),
  type: z.enum(["LINE", "TELEGRAM"]).optional(),
  config: z.record(z.unknown()).optional(),
  message: z.string().max(500).optional(),
});

export async function notificationChannelRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const userId = request.userId as string;
    const channels = await prisma.notificationChannel.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });

    return channels.map((channel) => ({
      id: channel.id,
      type: channel.type,
      name: channel.name,
      isActive: channel.isActive,
      lastTestedAt: channel.lastTestedAt,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
      config: maskNotificationConfig(channel),
    }));
  });

  app.put("/", async (request, reply) => {
    const userId = request.userId as string;
    const body = channelSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.notificationChannel.findFirst({
      where: { userId, type: body.data.type },
      select: { id: true },
    });
    const channel = existing
      ? await prisma.notificationChannel.update({
          where: { id: existing.id },
          data: {
            name: body.data.name,
            isActive: body.data.isActive ?? true,
            config: body.data.config as Prisma.InputJsonValue,
          },
        })
      : await prisma.notificationChannel.create({
          data: {
            userId,
            type: body.data.type,
            name: body.data.name,
            isActive: body.data.isActive ?? true,
            config: body.data.config as Prisma.InputJsonValue,
          },
        });

    return {
      id: channel.id,
      type: channel.type,
      name: channel.name,
      isActive: channel.isActive,
      lastTestedAt: channel.lastTestedAt,
      config: maskNotificationConfig(channel),
    };
  });

  app.post("/test", async (request, reply) => {
    const userId = request.userId as string;
    const body = testSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const message = body.data.message || "台股分析大師通知測試";
    const channel = body.data.channelId
      ? await prisma.notificationChannel.findFirst({
          where: { id: body.data.channelId, userId },
        })
      : null;

    const target =
      channel ??
      (body.data.type && body.data.config
        ? { type: body.data.type, config: body.data.config }
        : null);
    if (!target) {
      return reply.code(400).send({ error: "請提供 channelId 或 type/config" });
    }

    const result = await sendNotification(target, message);
    if (channel && result.ok) {
      await prisma.notificationChannel.update({
        where: { id: channel.id },
        data: { lastTestedAt: new Date() },
      });
    }

    return result;
  });
}
