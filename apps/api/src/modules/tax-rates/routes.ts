import type { FastifyPluginAsync } from "fastify";
import { idSchema, taxRateInputSchema } from "@invoice-forge/contracts";
import { prisma } from "../../lib/prisma.js";

export const taxRateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const rates = await prisma.taxRate.findMany({
      where: { businessId: request.auth!.businessId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return rates.map((rate) => ({ ...rate, rate: rate.rate.toString() }));
  });

  app.post("/", async (request, reply) => {
    const input = taxRateInputSchema.parse(request.body);
    const rate = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxRate.updateMany({ where: { businessId: request.auth!.businessId }, data: { isDefault: false } });
      }
      return tx.taxRate.create({ data: { businessId: request.auth!.businessId, ...input } });
    });
    return reply.code(201).send({ ...rate, rate: rate.rate.toString() });
  });

  app.delete("/:taxRateId", async (request, reply) => {
    const taxRateId = idSchema.parse((request.params as { taxRateId: string }).taxRateId);
    const result = await prisma.taxRate.updateMany({
      where: { id: taxRateId, businessId: request.auth!.businessId, isActive: true },
      data: { isActive: false, archivedAt: new Date(), version: { increment: 1 } },
    });
    if (!result.count)
      return reply.code(404).send({ code: "NOT_FOUND", message: "Tax rate not found.", requestId: request.id });
    return reply.code(204).send();
  });
};
