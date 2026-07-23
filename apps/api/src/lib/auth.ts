import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env.js";
import { prisma } from "./prisma.js";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calculated = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return calculated.length === expected.length && timingSafeEqual(calculated, expected);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 86_400_000);
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } }),
    prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } }),
  ]);
  return token;
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function authenticateRequest(request: FastifyRequest): Promise<void> {
  const token = request.cookies[env.sessionCookieName];
  if (!token) {
    request.auth = null;
    return;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { business: { deletedAt: null } },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { businessId: true, role: true },
          },
        },
      },
    },
  });

  const membership = session?.user.memberships[0];
  if (!session || session.expiresAt <= new Date() || !membership) {
    request.auth = null;
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return;
  }

  request.auth = {
    userId: session.userId,
    businessId: membership.businessId,
    role: membership.role,
  };
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.auth) {
    await reply.code(401).send({ code: "UNAUTHENTICATED", message: "Sign in to continue.", requestId: request.id });
  }
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(env.sessionCookieName, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.sessionTtlDays * 86_400,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
  });
}
