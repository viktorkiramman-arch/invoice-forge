import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { customerInputSchema, customerUpdateSchema, idSchema } from "@invoice-forge/contracts";
import { prisma } from "../../lib/prisma.js";

const customerListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  archived: z.enum(["true", "false"]).default("false"),
});

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const query = customerListQuery.parse(request.query);
    const search = query.search;
    const archived = query.archived === "true";
    return prisma.customer.findMany({
      where: {
        businessId: request.auth!.businessId,
        deletedAt: null,
        archivedAt: archived ? { not: null } : null,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { companyName: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { invoices: { where: { deletedAt: null } } },
        },
      },
      take: 200,
    });
  });

  app.post("/", async (request, reply) => {
    const input = customerInputSchema.parse(request.body);
    const customer = await prisma.customer.create({
      data: {
        businessId: request.auth!.businessId,
        name: input.name,
        companyName: input.companyName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        taxIdentifier: input.taxIdentifier ?? null,
        internalNotes: input.internalNotes ?? null,
      },
    });
    return reply.code(201).send(customer);
  });

  app.get("/:customerId", async (request, reply) => {
    const customerId = idSchema.parse((request.params as { customerId: string }).customerId);
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: request.auth!.businessId, deletedAt: null },
    });
    if (!customer)
      return reply.code(404).send({ code: "NOT_FOUND", message: "Customer not found.", requestId: request.id });
    return customer;
  });

  app.patch("/:customerId", async (request, reply) => {
    const customerId = idSchema.parse((request.params as { customerId: string }).customerId);
    const input = customerUpdateSchema.parse(request.body);
    const { version, ...data } = input;
    const result = await prisma.customer.updateMany({
      where: { id: customerId, businessId: request.auth!.businessId, version, deletedAt: null },
      data: {
        name: data.name,
        companyName: data.companyName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        addressLine1: data.addressLine1 ?? null,
        addressLine2: data.addressLine2 ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        postalCode: data.postalCode ?? null,
        country: data.country ?? null,
        taxIdentifier: data.taxIdentifier ?? null,
        internalNotes: data.internalNotes ?? null,
        version: { increment: 1 },
      },
    });
    if (!result.count)
      return reply
        .code(409)
        .send({ code: "VERSION_CONFLICT", message: "Customer changed or no longer exists.", requestId: request.id });
    return prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  });

  app.post("/:customerId/archive", async (request, reply) => {
    const customerId = idSchema.parse((request.params as { customerId: string }).customerId);
    const result = await prisma.customer.updateMany({
      where: { id: customerId, businessId: request.auth!.businessId, archivedAt: null, deletedAt: null },
      data: { archivedAt: new Date(), version: { increment: 1 } },
    });
    if (!result.count)
      return reply.code(404).send({ code: "NOT_FOUND", message: "Customer not found.", requestId: request.id });
    return reply.code(204).send();
  });

  app.post("/:customerId/restore", async (request, reply) => {
    const customerId = idSchema.parse((request.params as { customerId: string }).customerId);
    const result = await prisma.customer.updateMany({
      where: { id: customerId, businessId: request.auth!.businessId, archivedAt: { not: null }, deletedAt: null },
      data: { archivedAt: null, version: { increment: 1 } },
    });
    if (!result.count)
      return reply
        .code(404)
        .send({ code: "NOT_FOUND", message: "Archived customer not found.", requestId: request.id });
    return reply.code(204).send();
  });
};
