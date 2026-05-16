import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";

import { authRoutes } from "./routes/auth.js";
import { stockRoutes } from "./routes/stocks.js";
import { recommendationRoutes } from "./routes/recommendations.js";
import { watchlistRoutes } from "./routes/watchlists.js";
import { alertRoutes } from "./routes/alerts.js";
import { screenerRoutes } from "./routes/screener.js";
import { marketRoutes } from "./routes/market.js";
import { notificationChannelRoutes } from "./routes/notificationChannels.js";
import { portfolioRoutes } from "./routes/portfolio.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

// ─── Plugins ──────────────────────────────────

await app.register(cors, {
  origin: process.env.APP_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET || "dev-secret",
});

// ─── Decorators ───────────────────────────────
// 把 authenticate 掛到 app 上，讓 routes 可以用 app.authenticate

app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
    request.userId = (request.user as { userId: string }).userId;
  } catch (err) {
    reply.code(401).send({ error: "Unauthorized", message: "請先登入" });
  }
});

// TypeScript: 擴充 Fastify 型別
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
  interface FastifyRequest {
    userId?: string;
  }
}

// ─── Health Check ─────────────────────────────

app.get("/api/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// ─── Routes ───────────────────────────────────

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(stockRoutes, { prefix: "/api/stocks" });
await app.register(recommendationRoutes, { prefix: "/api/recommendations" });
await app.register(watchlistRoutes, { prefix: "/api/watchlists" });
await app.register(alertRoutes, { prefix: "/api/alerts" });
await app.register(screenerRoutes, { prefix: "/api/screener" });
await app.register(marketRoutes, { prefix: "/api/market" });
await app.register(notificationChannelRoutes, { prefix: "/api/notification-channels" });
await app.register(portfolioRoutes, { prefix: "/api/portfolio" });

// ─── Start ────────────────────────────────────

const PORT = parseInt(process.env.API_PORT || "3001", 10);

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 台股分析大師 API 啟動於 port ${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
