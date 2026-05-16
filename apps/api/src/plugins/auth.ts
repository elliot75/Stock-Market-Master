/**
 * JWT 認證插件與 middleware
 */
import type { FastifyRequest, FastifyReply } from "fastify";

export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * 驗證 JWT Token 的 preHandler
 * 用法: { preHandler: [authenticate] }
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const decoded = await request.jwtVerify<JwtPayload>();
    request.userId = decoded.userId;
  } catch (err) {
    reply.code(401).send({ error: "Unauthorized", message: "請先登入" });
  }
}

/**
 * 從 request 取得已驗證的 userId
 */
export function getUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new Error("Authenticated userId is missing");
  }
  return request.userId;
}
