/**
 * Auth Routes - 註冊、登入、取得當前使用者
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("無效的 email 格式"),
  password: z.string().min(6, "密碼至少 6 字元"),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post("/register", async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const { email, password, displayName } = body.data;

    // 檢查 email 是否已存在
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "此 email 已被註冊" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, displayName },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });

    const token = app.jwt.sign(
      { userId: user.id, email: user.email },
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return reply.code(201).send({ user, token });
  });

  // POST /api/auth/login
  app.post("/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "Validation Error",
        details: body.error.flatten().fieldErrors,
      });
    }

    const { email, password } = body.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ error: "帳號或密碼錯誤" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "帳號或密碼錯誤" });
    }

    const token = app.jwt.sign(
      { userId: user.id, email: user.email },
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      token,
    };
  });

  // GET /api/auth/me
  app.get(
    "/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      // @ts-expect-error - 由 authenticate 注入
      const userId = request.userId as string;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true, createdAt: true },
      });

      if (!user) {
        return reply.code(404).send({ error: "使用者不存在" });
      }

      return user;
    }
  );

  // PATCH /api/auth/me - 更新個人資料
  app.patch(
    "/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      // @ts-expect-error
      const userId = request.userId as string;
      const { displayName } = request.body as { displayName?: string };

      const user = await prisma.user.update({
        where: { id: userId },
        data: { displayName },
        select: { id: true, email: true, displayName: true, updatedAt: true },
      });

      return user;
    }
  );

  // POST /api/auth/change-password - 修改密碼
  app.post(
    "/change-password",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      // @ts-expect-error
      const userId = request.userId as string;
      const { currentPassword, newPassword } = request.body as any;

      if (!currentPassword || !newPassword || newPassword.length < 6) {
        return reply.code(400).send({ error: "無效的密碼參數" });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.code(404).send({ error: "使用者不存在" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: "舊密碼不正確" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      return { success: true };
    }
  );
}
