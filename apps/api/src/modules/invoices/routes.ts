import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  finalizeInvoiceSchema,
  idSchema,
  invoiceCalculationSchema,
  invoiceDraftInputSchema,
  invoiceDraftUpdateSchema,
  invoiceStatusSchema,
  statusUpdateSchema,
} from "@invoice-forge/contracts";
import { calculateInvoice } from "@invoice-forge/domain";
import { prisma } from "../../lib/prisma.js";
import { serializeInvoice } from "../../lib/serialization.js";
import { getOrCreateInvoicePdf } from "../pdf/service.js";
import {
  createDraft,
  duplicateInvoice,
  finalizeInvoice,
  loadInvoice,
  refreshOverdueInvoices,
  updateDraft,
  updateInvoiceStatus,
} from "./service.js";

const invoiceListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: invoiceStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["newest", "oldest", "due", "total"]).default("newest"),
});

function detailed(invoice: Awaited<ReturnType<typeof loadInvoice>>) {
  return {
    ...serializeInvoice(invoice),
    customer: invoice.customer,
    events: invoice.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      metadata: JSON.parse(event.metadata) as unknown,
      createdAt: event.createdAt,
      actorName: event.actor?.displayName ?? "System",
    })),
  };
}

export const invoiceRoutes: FastifyPluginAsync = async (app) => {
  app.post("/calculate", async (request) => {
    const input = invoiceCalculationSchema.parse(request.body);
    return calculateInvoice({
      currency: input.currency,
      taxMode: input.taxMode,
      items: input.items.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? null,
        tax: item.tax ? { name: item.tax.name, rate: item.tax.rate } : null,
      })),
      invoiceDiscount: input.invoiceDiscount ?? null,
    });
  });

  app.get("/", async (request) => {
    await refreshOverdueInvoices(request.auth!.businessId);
    const query = invoiceListQuery.parse(request.query);
    const where: Prisma.InvoiceWhereInput = {
      businessId: request.auth!.businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search } },
              { customer: { name: { contains: query.search } } },
              { customer: { companyName: { contains: query.search } } },
            ],
          }
        : {}),
    };
    const orderBy =
      query.sort === "oldest"
        ? { createdAt: "asc" as const }
        : query.sort === "due"
          ? { dueDate: "asc" as const }
          : query.sort === "total"
            ? { grandTotal: "desc" as const }
            : { createdAt: "desc" as const };

    const [items, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        include: { customer: { select: { id: true, name: true, companyName: true } } },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      items: items.map((invoice) => ({ ...serializeInvoice(invoice), customer: invoice.customer })),
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    };
  });

  app.post("/", async (request, reply) => {
    const input = invoiceDraftInputSchema.parse(request.body);
    const invoice = await createDraft(input, request.auth!.businessId, request.auth!.userId);
    return reply.code(201).send(detailed(await loadInvoice(invoice.id, request.auth!.businessId)));
  });

  app.get("/:invoiceId", async (request) => {
    const invoiceId = idSchema.parse((request.params as { invoiceId: string }).invoiceId);
    await refreshOverdueInvoices(request.auth!.businessId);
    return detailed(await loadInvoice(invoiceId, request.auth!.businessId));
  });

  app.patch("/:invoiceId", async (request) => {
    const invoiceId = idSchema.parse((request.params as { invoiceId: string }).invoiceId);
    const input = invoiceDraftUpdateSchema.parse(request.body);
    const invoice = await updateDraft(invoiceId, input, request.auth!.businessId, request.auth!.userId);
    return detailed(await loadInvoice(invoice.id, request.auth!.businessId));
  });

  app.delete("/:invoiceId", async (request, reply) => {
    const invoiceId = idSchema.parse((request.params as { invoiceId: string }).invoiceId);
    const result = await prisma.invoice.updateMany({
      where: { id: invoiceId, businessId: request.auth!.businessId, status: "DRAFT", deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    if (!result.count)
      return reply
        .code(409)
        .send({ code: "NOT_EDITABLE", message: "Only draft invoices can be deleted.", requestId: request.id });
    return reply.code(204).send();
  });

  app.post("/:invoiceId/finalize", async (request) => {
    const invoiceId = idSchema.parse((request.params as { invoiceId: string }).invoiceId);
    const input = finalizeInvoiceSchema.parse(request.body);
    const invoice = await finalizeInvoice(
      invoiceId,
      request.auth!.businessId,
      request.auth!.userId,
      input.version,
      input.customNumber,
    );
    let pdfStatus: "READY" | "FAILED" = "READY";
    try {
      await getOrCreateInvoicePdf(invoiceId, request.auth!.businessId);
      await prisma.invoiceEvent.create({
        data: {
          businessId: request.auth!.businessId,
          invoiceId,
          actorUserId: request.auth!.userId,
          eventType: "PDF_GENERATED",
        },
      });
    } catch (error) {
      request.log.error({ err: error, invoiceId }, "Final invoice PDF generation failed");
      pdfStatus = "FAILED";
    }
    return { ...detailed(await loadInvoice(invoice.id, request.auth!.businessId)), pdfStatus };
  });

  app.post("/:invoiceId/duplicate", async (request, reply) => {
    const invoiceId = idSchema.parse((request.params as { invoiceId: string }).invoiceId);
    const invoice = await duplicateInvoice(invoiceId, request.auth!.businessId, request.auth!.userId);
    return reply.code(201).send(detailed(invoice));
  });

  app.post("/:invoiceId/status", async (request) => {
    const invoiceId = idSchema.parse((request.params as { invoiceId: string }).invoiceId);
    const input = statusUpdateSchema.parse(request.body);
    return detailed(
      await updateInvoiceStatus(
        invoiceId,
        request.auth!.businessId,
        request.auth!.userId,
        input.status,
        input.version,
        input.reason,
      ),
    );
  });

  app.get(
    "/:invoiceId/pdf",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const invoiceId = idSchema.parse((request.params as { invoiceId: string }).invoiceId);
      const { buffer, filename } = await getOrCreateInvoicePdf(invoiceId, request.auth!.businessId);
      const inline = (request.query as { inline?: string }).inline === "true";
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${filename}"`)
        .send(buffer);
    },
  );
};
