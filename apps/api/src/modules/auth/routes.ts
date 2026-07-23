import type { FastifyPluginAsync } from "fastify";
import { loginSchema, registerSchema } from "@invoice-forge/contracts";
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  revokeSession,
  setSessionCookie,
  verifyPassword,
} from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/prisma.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/register",
    {
      config: { rateLimit: { max: env.nodeEnv === "production" ? 5 : 50, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      const input = registerSchema.parse(request.body);
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: input.email.toLowerCase(),
            displayName: input.displayName,
            passwordHash: hashPassword(input.password),
          },
        });
        const business = await tx.business.create({
          data: {
            name: input.businessName,
            memberships: { create: { userId: createdUser.id, role: "OWNER" } },
            taxRates: { create: { name: "Sales tax", rate: "0", isDefault: true } },
          },
        });
        return { user: createdUser, business };
      });
      const token = await createSession(user.user.id);
      setSessionCookie(reply, token);
      return reply.code(201).send({
        user: { id: user.user.id, email: user.user.email, displayName: user.user.displayName },
        business: { id: user.business.id, name: user.business.name },
      });
    },
  );
  app.post(
    "/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });

      if (!user || !verifyPassword(input.password, user.passwordHash)) {
        return reply
          .code(401)
          .send({ code: "INVALID_CREDENTIALS", message: "Email or password is incorrect.", requestId: request.id });
      }

      const token = await createSession(user.id);
      setSessionCookie(reply, token);
      return reply.send({ user: { id: user.id, email: user.email, displayName: user.displayName } });
    },
  );

  app.post("/logout", async (request, reply) => {
    await revokeSession(request.cookies[env.sessionCookieName]);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/me", async (request, reply) => {
    if (!request.auth)
      return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Sign in to continue.", requestId: request.id });

    const user = await prisma.user.findUnique({
      where: { id: request.auth.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        memberships: { select: { role: true, business: { select: { id: true, name: true } } } },
      },
    });
    return reply.send({ user });
  });
};
