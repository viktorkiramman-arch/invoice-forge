import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Prisma } from "@prisma/client";
import Fastify from "fastify";
import { ZodError } from "zod";
import { InvoiceDomainError } from "@invoice-forge/domain";
import { authenticateRequest, requireAuth } from "./lib/auth.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./modules/auth/routes.js";
import { businessRoutes } from "./modules/business/routes.js";
import { customerRoutes } from "./modules/customers/routes.js";
import { invoiceRoutes } from "./modules/invoices/routes.js";
import { refreshOverdueInvoices } from "./modules/invoices/service.js";
import { taxRateRoutes } from "./modules/tax-rates/routes.js";

export function buildApp() {
  const app = Fastify({ logger: { level: env.nodeEnv === "test" ? "silent" : "info" } });
  app.decorateRequest("auth", null);

  app.register(cookie);
  app.register(cors, { origin: env.webOrigin, credentials: true });
  app.register(helmet);
  app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

  app.addHook("onRequest", async (request, reply) => {
    const method = request.method.toUpperCase();
    const origin = request.headers.origin;
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && origin && origin !== env.webOrigin) {
      await reply
        .code(403)
        .send({ code: "INVALID_ORIGIN", message: "Request origin is not allowed.", requestId: request.id });
      return;
    }
    await authenticateRequest(request);
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(authRoutes, { prefix: "/api/v1/auth" });

  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", requireAuth);
    protectedApp.register(businessRoutes, { prefix: "/api/v1/business" });
    protectedApp.register(customerRoutes, { prefix: "/api/v1/customers" });
    protectedApp.register(taxRateRoutes, { prefix: "/api/v1/tax-rates" });
    protectedApp.register(invoiceRoutes, { prefix: "/api/v1/invoices" });

    protectedApp.get("/api/v1/dashboard", async (request) => {
      await refreshOverdueInvoices(request.auth!.businessId);
      const [grouped, recent] = await prisma.$transaction([
        prisma.invoice.groupBy({
          by: ["status", "currency"] as const,
          where: { businessId: request.auth!.businessId, deletedAt: null },
          orderBy: [{ status: "asc" }, { currency: "asc" }],
          _count: { _all: true },
          _sum: { grandTotal: true },
        }),
        prisma.invoice.findMany({
          where: { businessId: request.auth!.businessId, deletedAt: null },
          include: { customer: { select: { name: true, companyName: true } } },
          orderBy: { updatedAt: "desc" },
          take: 6,
        }),
      ]);
      return {
        summaries: grouped.map((item) => ({
          status: item.status,
          currency: item.currency,
          count: typeof item._count === "object" && item._count ? (item._count._all ?? 0) : 0,
          total: typeof item._sum === "object" && item._sum ? (item._sum.grandTotal?.toString() ?? "0") : "0",
        })),
        recent: recent.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          currency: invoice.currency,
          total: invoice.grandTotal.toString(),
          dueDate: invoice.dueDate.toISOString().slice(0, 10),
          customer: invoice.customer,
        })),
      };
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        code: "VALIDATION_ERROR",
        message: "The request contains invalid data.",
        fieldErrors: error.flatten().fieldErrors,
        requestId: request.id,
      });
    }
    if (error instanceof InvoiceDomainError) {
      return reply.code(422).send({ code: error.code, message: error.message, requestId: request.id });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return reply
        .code(409)
        .send({ code: "DUPLICATE_VALUE", message: "A record with that value already exists.", requestId: request.id });
    }

    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;
    const code = (error as Error & { code?: string }).code ?? "INTERNAL_ERROR";
    if (statusCode >= 500) request.log.error({ err: error }, "Request failed");
    return reply.code(statusCode).send({
      code,
      message:
        statusCode >= 500
          ? "An unexpected error occurred."
          : error instanceof Error
            ? error.message
            : "Request failed.",
      requestId: request.id,
    });
  });

  app.addHook("onClose", async () => prisma.$disconnect());
  return app;
}
