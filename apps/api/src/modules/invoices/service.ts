import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  assertInvoiceTransition,
  calculateInvoice,
  InvoiceDomainError,
  type InvoiceCalculationInput,
  type InvoiceStatus,
} from "@invoice-forge/domain";
import type { InvoiceDraftInput, InvoiceDraftUpdateInput } from "@invoice-forge/contracts";
import { dateFromString } from "../../lib/serialization.js";
import { prisma } from "../../lib/prisma.js";

function domainInput(input: InvoiceDraftInput): InvoiceCalculationInput {
  return {
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
  };
}

async function assertCustomerOwnership(customerId: string | null | undefined, businessId: string): Promise<void> {
  if (!customerId) return;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!customer) throw Object.assign(new Error("Customer not found."), { statusCode: 422, code: "INVALID_CUSTOMER" });
}

function itemCreateData(
  invoiceId: string,
  input: InvoiceDraftInput,
  calculation: ReturnType<typeof calculateInvoice>,
): Prisma.InvoiceItemCreateManyInput[] {
  return calculation.items.map((item, position) => {
    const source = input.items[position];
    if (!source) throw new InvoiceDomainError("ITEM_MISMATCH", "Calculated item does not match the invoice input.");

    return {
      invoiceId,
      position,
      description: source.description,
      quantity: source.quantity,
      unitPrice: source.unitPrice,
      baseAmount: item.baseAmount,
      discountType: source.discount?.type ?? null,
      discountValue: source.discount?.value ?? null,
      discountAmount: item.discountAmount,
      allocatedInvoiceDiscount: item.allocatedInvoiceDiscount,
      taxableAmount: item.taxableAmount,
      taxRateId: source.tax?.taxRateId ?? null,
      taxName: source.tax?.name ?? null,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      lineTotal: item.lineTotal,
    };
  });
}

function invoiceData(input: InvoiceDraftInput, calculation: ReturnType<typeof calculateInvoice>) {
  const issueDate = dateFromString(input.issueDate);
  const dueDate = dateFromString(input.dueDate);
  if (dueDate < issueDate) {
    throw Object.assign(new Error("Due date cannot be before issue date."), {
      statusCode: 422,
      code: "INVALID_DATE_RANGE",
    });
  }
  return {
    customerId: input.customerId ?? null,
    currency: input.currency,
    taxMode: input.taxMode,
    issueDate,
    dueDate,
    purchaseOrderNumber: input.purchaseOrderNumber ?? null,
    projectReference: input.projectReference ?? null,
    notes: input.notes ?? null,
    internalNotes: input.internalNotes ?? null,
    paymentTerms: input.paymentTerms ?? null,
    itemsSubtotal: calculation.itemsSubtotal,
    lineDiscountTotal: calculation.lineDiscountTotal,
    invoiceDiscountType: input.invoiceDiscount?.type ?? null,
    invoiceDiscountValue: input.invoiceDiscount?.value ?? null,
    invoiceDiscountTotal: calculation.invoiceDiscountTotal,
    discountTotal: calculation.discountTotal,
    netSubtotal: calculation.netSubtotal,
    taxTotal: calculation.taxTotal,
    grandTotal: calculation.grandTotal,
    calculationVersion: calculation.calculationVersion,
  };
}

async function persistDraft(
  tx: Prisma.TransactionClient,
  input: InvoiceDraftInput,
  calculation: ReturnType<typeof calculateInvoice>,
  businessId: string,
  actorUserId: string,
  duplicatedFromInvoiceId?: string,
) {
  const invoice = await tx.invoice.create({
    data: {
      businessId,
      status: "DRAFT",
      ...(duplicatedFromInvoiceId ? { duplicatedFromInvoiceId } : {}),
      ...invoiceData(input, calculation),
    },
  });
  await tx.invoiceItem.createMany({ data: itemCreateData(invoice.id, input, calculation) });
  await tx.invoiceEvent.createMany({
    data: [
      { businessId, invoiceId: invoice.id, actorUserId, eventType: "INVOICE_CREATED" },
      ...(duplicatedFromInvoiceId
        ? [
            {
              businessId,
              invoiceId: invoice.id,
              actorUserId,
              eventType: "INVOICE_DUPLICATED",
              metadata: JSON.stringify({ sourceInvoiceId: duplicatedFromInvoiceId }),
            },
          ]
        : []),
    ],
  });
  return tx.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    include: { items: { orderBy: { position: "asc" } }, customer: true },
  });
}

export async function createDraft(input: InvoiceDraftInput, businessId: string, actorUserId: string) {
  await assertCustomerOwnership(input.customerId, businessId);
  const calculation = calculateInvoice(domainInput(input));
  return prisma.$transaction((tx) => persistDraft(tx, input, calculation, businessId, actorUserId));
}

export async function updateDraft(
  invoiceId: string,
  input: InvoiceDraftUpdateInput,
  businessId: string,
  actorUserId: string,
) {
  await assertCustomerOwnership(input.customerId, businessId);
  const calculation = calculateInvoice(domainInput(input));

  return prisma.$transaction(async (tx) => {
    const result = await tx.invoice.updateMany({
      where: { id: invoiceId, businessId, status: "DRAFT", version: input.version, deletedAt: null },
      data: { ...invoiceData(input, calculation), version: { increment: 1 } },
    });
    if (!result.count) {
      throw Object.assign(new Error("Invoice changed or is no longer editable."), {
        statusCode: 409,
        code: "VERSION_CONFLICT",
      });
    }

    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    await tx.invoiceItem.createMany({ data: itemCreateData(invoiceId, input, calculation) });
    await tx.invoiceEvent.create({
      data: { businessId, invoiceId, actorUserId, eventType: "DRAFT_UPDATED" },
    });
    return tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { items: { orderBy: { position: "asc" } }, customer: true },
    });
  });
}

function invoiceInputFromStored(
  invoice: Prisma.InvoiceGetPayload<{ include: { items: true; customer: true } }>,
): InvoiceDraftInput {
  return {
    customerId: invoice.customerId,
    currency: invoice.currency,
    taxMode: invoice.taxMode as "EXCLUSIVE" | "INCLUSIVE",
    issueDate: invoice.issueDate.toISOString().slice(0, 10),
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    purchaseOrderNumber: invoice.purchaseOrderNumber,
    projectReference: invoice.projectReference,
    notes: invoice.notes,
    internalNotes: invoice.internalNotes,
    paymentTerms: invoice.paymentTerms,
    invoiceDiscount:
      invoice.invoiceDiscountType && invoice.invoiceDiscountValue
        ? {
            type: invoice.invoiceDiscountType as "PERCENTAGE" | "FIXED",
            value: invoice.invoiceDiscountValue.toString(),
          }
        : null,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      discount:
        item.discountType && item.discountValue
          ? { type: item.discountType as "PERCENTAGE" | "FIXED", value: item.discountValue.toString() }
          : null,
      tax:
        item.taxName && !item.taxRate.isZero()
          ? { name: item.taxName, rate: item.taxRate.toString(), taxRateId: item.taxRateId }
          : null,
    })),
  };
}

export async function loadInvoice(invoiceId: string, businessId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId, deletedAt: null },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
      events: { orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { displayName: true } } } },
    },
  });
  if (!invoice) throw Object.assign(new Error("Invoice not found."), { statusCode: 404, code: "NOT_FOUND" });
  return invoice;
}

function customerSnapshot(customer: NonNullable<Awaited<ReturnType<typeof loadInvoice>>["customer"]>): string {
  return JSON.stringify({
    name: customer.name,
    companyName: customer.companyName,
    email: customer.email,
    phone: customer.phone,
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    region: customer.region,
    postalCode: customer.postalCode,
    country: customer.country,
    taxIdentifier: customer.taxIdentifier,
  });
}

function businessSnapshot(business: {
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  taxIdentifier: string | null;
  logoDataUrl: string | null;
}): string {
  return JSON.stringify({
    name: business.name,
    legalName: business.legalName,
    email: business.email,
    phone: business.phone,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2,
    city: business.city,
    region: business.region,
    postalCode: business.postalCode,
    country: business.country,
    taxIdentifier: business.taxIdentifier,
    logoDataUrl: business.logoDataUrl,
  });
}

export async function finalizeInvoice(
  invoiceId: string,
  businessId: string,
  actorUserId: string,
  version: number,
  customNumber?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId, deletedAt: null },
      include: { items: { orderBy: { position: "asc" } }, customer: true, business: true },
    });
    if (!invoice) throw Object.assign(new Error("Invoice not found."), { statusCode: 404, code: "NOT_FOUND" });
    if (invoice.status !== "DRAFT" || invoice.version !== version) {
      throw Object.assign(new Error("Invoice changed or is no longer a draft."), {
        statusCode: 409,
        code: "VERSION_CONFLICT",
      });
    }
    if (!invoice.customer) throw new InvoiceDomainError("CUSTOMER_REQUIRED", "Select a customer before finalizing.");
    if (invoice.items.some((item) => !item.description.trim())) {
      throw new InvoiceDomainError("DESCRIPTION_REQUIRED", "Every invoice item needs a description.");
    }

    const input = invoiceInputFromStored(invoice);
    const calculation = calculateInvoice(domainInput(input));
    if (/^0(?:\.0+)?$/.test(calculation.grandTotal)) {
      throw new InvoiceDomainError("TOTAL_REQUIRED", "Final invoice total must be greater than zero.");
    }

    let number = customNumber?.trim().toUpperCase() || null;
    if (!number) {
      const year = invoice.issueDate.getUTCFullYear();
      const sequence = await tx.invoiceSequence.upsert({
        where: { businessId_year: { businessId, year } },
        create: { businessId, year, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });
      number = `${invoice.business.invoicePrefix}-${year}-${String(sequence.lastValue).padStart(4, "0")}`;
    }

    const calculationSnapshot = JSON.stringify(calculation);
    const result = await tx.invoice.updateMany({
      where: { id: invoiceId, businessId, status: "DRAFT", version },
      data: {
        number,
        status: "FINALIZED",
        businessSnapshot: businessSnapshot(invoice.business),
        customerSnapshot: customerSnapshot(invoice.customer),
        calculationSnapshot,
        calculationChecksum: calculationChecksum(calculationSnapshot),
        finalizedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (!result.count)
      throw Object.assign(new Error("Invoice finalization conflicted with another update."), {
        statusCode: 409,
        code: "VERSION_CONFLICT",
      });

    await tx.invoiceEvent.create({
      data: {
        businessId,
        invoiceId,
        actorUserId,
        eventType: "INVOICE_FINALIZED",
        previousStatus: "DRAFT",
        newStatus: "FINALIZED",
        metadata: JSON.stringify({ number }),
      },
    });

    return tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { items: { orderBy: { position: "asc" } }, customer: true },
    });
  });
}

export async function duplicateInvoice(invoiceId: string, businessId: string, actorUserId: string) {
  const [source, business] = await Promise.all([
    loadInvoice(invoiceId, businessId),
    prisma.business.findFirstOrThrow({
      where: { id: businessId, deletedAt: null },
      select: { timezone: true },
    }),
  ]);
  const input = invoiceInputFromStored(source);
  const today = businessDate(business.timezone);
  const duration = Math.max(0, Math.round((source.dueDate.getTime() - source.issueDate.getTime()) / 86_400_000));
  input.issueDate = today.toISOString().slice(0, 10);
  input.dueDate = new Date(today.getTime() + duration * 86_400_000).toISOString().slice(0, 10);
  input.items = input.items.map(({ id: _id, ...item }) => item);

  await assertCustomerOwnership(input.customerId, businessId);
  const calculation = calculateInvoice(domainInput(input));
  const draft = await prisma.$transaction((tx) =>
    persistDraft(tx, input, calculation, businessId, actorUserId, invoiceId),
  );
  return loadInvoice(draft.id, businessId);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  businessId: string,
  actorUserId: string,
  targetStatus: InvoiceStatus,
  version: number,
  reason?: string | null,
) {
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId, deletedAt: null },
      select: { status: true },
    });
    if (!invoice) {
      throw Object.assign(new Error("Invoice not found."), { statusCode: 404, code: "NOT_FOUND" });
    }
    assertInvoiceTransition(invoice.status as InvoiceStatus, targetStatus);
    if (targetStatus === "VOID" && !reason?.trim()) {
      throw new InvoiceDomainError("VOID_REASON_REQUIRED", "A reason is required to void an invoice.");
    }

    const result = await tx.invoice.updateMany({
      where: { id: invoiceId, businessId, status: invoice.status, version, deletedAt: null },
      data: {
        status: targetStatus,
        ...(targetStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        ...(targetStatus === "VOID" ? { voidedAt: new Date() } : {}),
        pdfPath: null,
        pdfChecksum: null,
        version: { increment: 1 },
      },
    });
    if (!result.count) {
      throw Object.assign(new Error("Invoice status changed in another session."), {
        statusCode: 409,
        code: "VERSION_CONFLICT",
      });
    }

    await tx.invoiceEvent.create({
      data: {
        businessId,
        invoiceId,
        actorUserId,
        eventType: "STATUS_CHANGED",
        previousStatus: invoice.status,
        newStatus: targetStatus,
        metadata: JSON.stringify({ reason: reason ?? null }),
      },
    });
  });
  return loadInvoice(invoiceId, businessId);
}

function businessDate(timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

export async function refreshOverdueInvoices(businessId: string): Promise<void> {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { timezone: true } });
  const today = businessDate(business.timezone);
  const overdue = await prisma.invoice.findMany({
    where: { businessId, status: "FINALIZED", dueDate: { lt: today }, deletedAt: null },
    select: { id: true },
  });
  if (!overdue.length) return;

  await prisma.$transaction(async (tx) => {
    for (const item of overdue) {
      const updated = await tx.invoice.updateMany({
        where: { id: item.id, status: "FINALIZED" },
        data: { status: "OVERDUE", pdfPath: null, pdfChecksum: null, version: { increment: 1 } },
      });
      if (updated.count) {
        await tx.invoiceEvent.create({
          data: {
            businessId,
            invoiceId: item.id,
            eventType: "STATUS_CHANGED",
            previousStatus: "FINALIZED",
            newStatus: "OVERDUE",
            metadata: JSON.stringify({ source: "DUE_DATE" }),
          },
        });
      }
    }
  });
}

export function calculationChecksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
