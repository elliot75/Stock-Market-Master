import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { z } from "zod";
import { calculateHoldingMetrics } from "../lib/portfolioMetrics.js";

const holdingSchema = z.object({
  symbol: z.string().min(1),
  shares: z.number().positive(),
  averageCost: z.number().positive(),
  targetPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  note: z.string().max(500).optional(),
});

const updateHoldingSchema = holdingSchema.partial().omit({ symbol: true });

export async function portfolioRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/holdings", async (request) => {
    const userId = request.userId as string;
    const holdings = await prisma.portfolioHolding.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        stock: { select: { name: true, industry: true, marketType: true } },
      },
    });

    const symbols = holdings.map((holding) => holding.symbol);
    const latestPrices = await prisma.dailyPrice.findMany({
      where: { symbol: { in: symbols } },
      orderBy: { date: "desc" },
      distinct: ["symbol"],
    });
    const priceMap = new Map(latestPrices.map((price) => [price.symbol, price]));

    return holdings.map((holding) => {
      const latestPrice = priceMap.get(holding.symbol);
      const shares = Number(holding.shares);
      const averageCost = Number(holding.averageCost);
      const close = latestPrice ? Number(latestPrice.close) : null;
      const metrics = calculateHoldingMetrics({ shares, averageCost, latestPrice: close });

      return {
        id: holding.id,
        symbol: holding.symbol,
        name: holding.stock.name,
        industry: holding.stock.industry,
        marketType: holding.stock.marketType,
        shares,
        averageCost,
        targetPrice: holding.targetPrice != null ? Number(holding.targetPrice) : null,
        stopLoss: holding.stopLoss != null ? Number(holding.stopLoss) : null,
        note: holding.note,
        latestPrice: close,
        priceDate: latestPrice?.date ?? null,
        ...metrics,
        updatedAt: holding.updatedAt,
      };
    });
  });

  app.post("/holdings", async (request, reply) => {
    const userId = request.userId as string;
    const body = holdingSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const stock = await prisma.stock.findUnique({
      where: { symbol: body.data.symbol },
      select: { symbol: true },
    });
    if (!stock) return reply.code(404).send({ error: `股票 ${body.data.symbol} 不存在` });

    const holding = await prisma.portfolioHolding.upsert({
      where: {
        userId_symbol: {
          userId,
          symbol: body.data.symbol,
        },
      },
      update: {
        shares: body.data.shares,
        averageCost: body.data.averageCost,
        targetPrice: body.data.targetPrice,
        stopLoss: body.data.stopLoss,
        note: body.data.note,
      },
      create: {
        userId,
        symbol: body.data.symbol,
        shares: body.data.shares,
        averageCost: body.data.averageCost,
        targetPrice: body.data.targetPrice,
        stopLoss: body.data.stopLoss,
        note: body.data.note,
      },
    });

    return reply.code(201).send(holding);
  });

  app.patch("/holdings/:id", async (request, reply) => {
    const userId = request.userId as string;
    const { id } = request.params as { id: string };
    const body = updateHoldingSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.portfolioHolding.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: "持倉不存在" });

    return prisma.portfolioHolding.update({
      where: { id },
      data: body.data,
    });
  });

  app.delete("/holdings/:id", async (request, reply) => {
    const userId = request.userId as string;
    const { id } = request.params as { id: string };
    const existing = await prisma.portfolioHolding.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: "持倉不存在" });

    await prisma.portfolioHolding.delete({ where: { id } });
    return { success: true };
  });
}
