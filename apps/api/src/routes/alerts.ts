/**
 * Alert Routes - 提醒規則管理與事件查詢
 * 需要登入認證
 */
import type { FastifyInstance } from "fastify";
import { prisma, Prisma } from "@repo/database";
import { z } from "zod";

const createAlertSchema = z.object({
  symbol: z.string().min(1),
  conditionType: z.enum([
    "PRICE_ABOVE",
    "PRICE_BELOW",
    "VOLUME_SPIKE",
    "FOREIGN_NET_BUY",
    "FOREIGN_NET_SELL",
    "TRUST_NET_BUY",
    "SCORE_UPGRADE",
    "SCORE_DOWNGRADE",
    "BREAK_SUPPORT",
    "BREAK_RESISTANCE",
  ]),
  threshold: z.number().optional(),
  customConfig: z.record(z.unknown()).optional(),
});

export async function alertRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // GET /api/alerts/rules - 取得所有提醒規則
  app.get("/rules", async (request) => {
    const userId = request.userId as string;

    const rules = await prisma.alertRule.findMany({
      where: { userId },
      include: {
        stock: { select: { symbol: true, name: true } },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return rules.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      stockName: r.stock.name,
      conditionType: r.conditionType,
      threshold: r.threshold ? Number(r.threshold) : null,
      customConfig: r.customConfig,
      isActive: r.isActive,
      eventCount: r._count.events,
      createdAt: r.createdAt,
    }));
  });

  // POST /api/alerts/rules - 新增提醒規則
  app.post("/rules", async (request, reply) => {
    const userId = request.userId as string;

    const body = createAlertSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    // 確認股票存在
    const stock = await prisma.stock.findUnique({
      where: { symbol: body.data.symbol },
    });
    if (!stock) {
      return reply
        .code(404)
        .send({ error: `股票 ${body.data.symbol} 不存在` });
    }

    const rule = await prisma.alertRule.create({
      data: {
        userId,
        symbol: body.data.symbol,
        conditionType: body.data.conditionType,
        threshold: body.data.threshold,
        customConfig: body.data.customConfig as Prisma.InputJsonValue | undefined,
      },
    });

    return reply.code(201).send(rule);
  });

  // PATCH /api/alerts/rules/:ruleId - 啟用/停用規則
  app.patch("/rules/:ruleId", async (request, reply) => {
    const userId = request.userId as string;
    const { ruleId } = request.params as { ruleId: string };
    const { isActive } = request.body as { isActive?: boolean };

    const rule = await prisma.alertRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) {
      return reply.code(404).send({ error: "規則不存在" });
    }

    const updated = await prisma.alertRule.update({
      where: { id: ruleId },
      data: { isActive: isActive ?? !rule.isActive },
    });

    return updated;
  });

  // DELETE /api/alerts/rules/:ruleId - 刪除規則
  app.delete("/rules/:ruleId", async (request, reply) => {
    const userId = request.userId as string;
    const { ruleId } = request.params as { ruleId: string };

    const rule = await prisma.alertRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) {
      return reply.code(404).send({ error: "規則不存在" });
    }

    await prisma.alertRule.delete({ where: { id: ruleId } });
    return { success: true };
  });

  // GET /api/alerts/events - 取得已觸發通知
  // Query: limit, offset, unreadOnly
  app.get("/events", async (request) => {
    const userId = request.userId as string;
    const query = request.query as {
      limit?: string;
      offset?: string;
      unreadOnly?: string;
    };

    const limit = Math.min(parseInt(query.limit || "50", 10), 100);
    const offset = parseInt(query.offset || "0", 10);
    const unreadOnly = query.unreadOnly === "true";

    const where: Record<string, unknown> = {
      rule: { userId },
    };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [total, events] = await Promise.all([
      prisma.alertEvent.count({ where }),
      prisma.alertEvent.findMany({
        where,
        orderBy: { triggeredAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          rule: {
            select: {
              symbol: true,
              conditionType: true,
              stock: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: events.map((e) => ({
        id: e.id,
        symbol: e.rule.symbol,
        stockName: e.rule.stock.name,
        conditionType: e.rule.conditionType,
        message: e.message,
        isRead: e.isRead,
        triggeredAt: e.triggeredAt,
      })),
      meta: { total, limit, offset },
    };
  });

  // PATCH /api/alerts/events/:eventId/read - 標記已讀
  app.patch("/events/:eventId/read", async (request, reply) => {
    const userId = request.userId as string;
    const { eventId } = request.params as { eventId: string };

    const event = await prisma.alertEvent.findFirst({
      where: { id: eventId, rule: { userId } },
    });
    if (!event) {
      return reply.code(404).send({ error: "通知不存在" });
    }

    await prisma.alertEvent.update({
      where: { id: eventId },
      data: { isRead: true },
    });

    return { success: true };
  });

  // POST /api/alerts/events/read-all - 全部標記已讀
  app.post("/events/read-all", async (request) => {
    const userId = request.userId as string;

    const result = await prisma.alertEvent.updateMany({
      where: { rule: { userId }, isRead: false },
      data: { isRead: true },
    });

    return { markedCount: result.count };
  });
}
