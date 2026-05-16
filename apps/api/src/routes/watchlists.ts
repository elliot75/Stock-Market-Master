/**
 * Watchlist Routes - 自選股管理
 * 需要登入認證
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { z } from "zod";
import { getWatchlistItemOwnershipWhere } from "../lib/watchlistAuth.js";

const createWatchlistSchema = z.object({
  name: z.string().min(1, "清單名稱不可為空").max(50),
  description: z.string().max(200).optional(),
});

const addItemSchema = z.object({
  symbol: z.string().min(1),
  addedReason: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
});

const updateItemSchema = z.object({
  note: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  addedReason: z.string().max(200).optional(),
});

export async function watchlistRoutes(app: FastifyInstance) {
  // 所有 watchlist 路由都需要認證
  app.addHook("preHandler", app.authenticate);

  // GET /api/watchlists - 取得所有自選清單
  app.get("/", async (request) => {
    const userId = request.userId as string;

    const watchlists = await prisma.watchlist.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { items: true } },
      },
    });

    return watchlists.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      itemCount: w._count.items,
      sortOrder: w.sortOrder,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  });

  // POST /api/watchlists - 建立新清單
  app.post("/", async (request, reply) => {
    const userId = request.userId as string;

    const body = createWatchlistSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const watchlist = await prisma.watchlist.create({
      data: {
        userId,
        name: body.data.name,
        description: body.data.description,
      },
    });

    return reply.code(201).send(watchlist);
  });

  // GET /api/watchlists/:id - 取得清單內股票 (含最新狀態)
  app.get("/:id", async (request, reply) => {
    const userId = request.userId as string;
    const { id } = request.params as { id: string };

    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            stock: {
              select: {
                symbol: true,
                name: true,
                marketType: true,
                industry: true,
              },
            },
          },
          orderBy: { addedAt: "desc" },
        },
      },
    });

    if (!watchlist) {
      return reply.code(404).send({ error: "清單不存在" });
    }

    // 批次取得最新報價與分數
    const symbols = watchlist.items.map((i) => i.symbol);

    const [latestPrices, latestScores] = await Promise.all([
      prisma.dailyPrice.findMany({
        where: { symbol: { in: symbols } },
        orderBy: { date: "desc" },
        distinct: ["symbol"],
      }),
      prisma.scoreSnapshot.findMany({
        where: { symbol: { in: symbols } },
        orderBy: { date: "desc" },
        distinct: ["symbol"],
      }),
    ]);

    const priceMap = new Map(latestPrices.map((p) => [p.symbol, p]));
    const scoreMap = new Map(latestScores.map((s) => [s.symbol, s]));

    const items = watchlist.items.map((item) => {
      const price = priceMap.get(item.symbol);
      const score = scoreMap.get(item.symbol);

      return {
        id: item.id,
        symbol: item.symbol,
        name: item.stock.name,
        marketType: item.stock.marketType,
        industry: item.stock.industry,
        addedReason: item.addedReason,
        note: item.note,
        tags: item.tags,
        addedAt: item.addedAt,
        // 最新行情
        price: price
          ? {
              close: Number(price.close),
              change: Number(price.change),
              changePercent: price.changePercent
                ? Number(price.changePercent)
                : null,
              volume: Number(price.volume),
              date: price.date,
            }
          : null,
        // 最新評分
        score: score
          ? {
              compositeScore: Number(score.compositeScore),
              category: score.category,
              riskScore: Number(score.riskScore),
            }
          : null,
      };
    });

    return {
      id: watchlist.id,
      name: watchlist.name,
      description: watchlist.description,
      items,
    };
  });

  // PUT /api/watchlists/:id - 更新清單名稱/描述
  app.put("/:id", async (request, reply) => {
    const userId = request.userId as string;
    const { id } = request.params as { id: string };

    const body = createWatchlistSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.watchlist.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return reply.code(404).send({ error: "清單不存在" });
    }

    const updated = await prisma.watchlist.update({
      where: { id },
      data: {
        name: body.data.name,
        description: body.data.description,
      },
    });

    return updated;
  });

  // DELETE /api/watchlists/:id - 刪除清單
  app.delete("/:id", async (request, reply) => {
    const userId = request.userId as string;
    const { id } = request.params as { id: string };

    const existing = await prisma.watchlist.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return reply.code(404).send({ error: "清單不存在" });
    }

    await prisma.watchlist.delete({ where: { id } });
    return { success: true };
  });

  // POST /api/watchlists/:id/items - 加入股票到清單
  app.post("/:id/items", async (request, reply) => {
    const userId = request.userId as string;
    const { id } = request.params as { id: string };

    const body = addItemSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    // 確認清單歸屬
    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId },
    });
    if (!watchlist) {
      return reply.code(404).send({ error: "清單不存在" });
    }

    // 確認股票存在
    const stock = await prisma.stock.findUnique({
      where: { symbol: body.data.symbol },
    });
    if (!stock) {
      return reply.code(404).send({ error: `股票 ${body.data.symbol} 不存在` });
    }

    // 檢查是否已在清單中
    const existingItem = await prisma.watchlistItem.findUnique({
      where: {
        watchlistId_symbol: {
          watchlistId: id,
          symbol: body.data.symbol,
        },
      },
    });
    if (existingItem) {
      return reply.code(409).send({ error: "此股票已在清單中" });
    }

    const item = await prisma.watchlistItem.create({
      data: {
        watchlistId: id,
        symbol: body.data.symbol,
        addedReason: body.data.addedReason,
        note: body.data.note,
        tags: body.data.tags || [],
      },
    });

    return reply.code(201).send(item);
  });

  // PATCH /api/watchlists/:id/items/:itemId - 更新備註/標籤
  app.patch("/:id/items/:itemId", async (request, reply) => {
    const userId = request.userId as string;
    const { id, itemId } = request.params as { id: string; itemId: string };

    const body = updateItemSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    // 驗證 item 必須同時屬於此清單與目前使用者，避免已知 itemId 時越權修改。
    const item = await prisma.watchlistItem.findFirst({
      where: getWatchlistItemOwnershipWhere({ itemId, watchlistId: id, userId }),
      select: { id: true },
    });
    if (!item) {
      return reply.code(404).send({ error: "清單項目不存在" });
    }

    const updated = await prisma.watchlistItem.update({
      where: { id: itemId },
      data: {
        note: body.data.note,
        tags: body.data.tags,
        addedReason: body.data.addedReason,
      },
    });

    return updated;
  });

  // DELETE /api/watchlists/:id/items/:itemId - 從清單移除股票
  app.delete("/:id/items/:itemId", async (request, reply) => {
    const userId = request.userId as string;
    const { id, itemId } = request.params as { id: string; itemId: string };

    const item = await prisma.watchlistItem.findFirst({
      where: getWatchlistItemOwnershipWhere({ itemId, watchlistId: id, userId }),
      select: { id: true },
    });
    if (!item) {
      return reply.code(404).send({ error: "清單項目不存在" });
    }

    await prisma.watchlistItem.delete({ where: { id: itemId } });
    return { success: true };
  });
}
