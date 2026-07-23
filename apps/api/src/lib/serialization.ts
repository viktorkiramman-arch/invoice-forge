import type { Invoice, InvoiceItem } from "@prisma/client";

export function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function dateFromString(value: string): Date {
  const result = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error("Date must be a valid calendar date in YYYY-MM-DD format."), {
      statusCode: 422,
      code: "INVALID_DATE",
    });
  }
  return result;
}

export function decimalString(value: { toString(): string }): string {
  return value.toString();
}

export function serializeInvoice(invoice: Invoice & { items?: InvoiceItem[] }): Record<string, unknown> {
  return {
    id: invoice.id,
    customerId: invoice.customerId,
    duplicatedFromInvoiceId: invoice.duplicatedFromInvoiceId,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    taxMode: invoice.taxMode,
    issueDate: toDateString(invoice.issueDate),
    dueDate: toDateString(invoice.dueDate),
    purchaseOrderNumber: invoice.purchaseOrderNumber,
    projectReference: invoice.projectReference,
    notes: invoice.notes,
    internalNotes: invoice.internalNotes,
    paymentTerms: invoice.paymentTerms,
    itemsSubtotal: decimalString(invoice.itemsSubtotal),
    lineDiscountTotal: decimalString(invoice.lineDiscountTotal),
    invoiceDiscountType: invoice.invoiceDiscountType,
    invoiceDiscountValue: invoice.invoiceDiscountValue?.toString() ?? null,
    invoiceDiscountTotal: decimalString(invoice.invoiceDiscountTotal),
    discountTotal: decimalString(invoice.discountTotal),
    netSubtotal: decimalString(invoice.netSubtotal),
    taxTotal: decimalString(invoice.taxTotal),
    grandTotal: decimalString(invoice.grandTotal),
    calculationVersion: invoice.calculationVersion,
    finalizedAt: invoice.finalizedAt,
    cancelledAt: invoice.cancelledAt,
    voidedAt: invoice.voidedAt,
    version: invoice.version,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    ...(invoice.items
      ? {
          items: invoice.items.map((item) => ({
            id: item.id,
            position: item.position,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            baseAmount: item.baseAmount.toString(),
            discountType: item.discountType,
            discountValue: item.discountValue?.toString() ?? null,
            discountAmount: item.discountAmount.toString(),
            allocatedInvoiceDiscount: item.allocatedInvoiceDiscount.toString(),
            taxableAmount: item.taxableAmount.toString(),
            taxRateId: item.taxRateId,
            taxName: item.taxName,
            taxRate: item.taxRate.toString(),
            taxAmount: item.taxAmount.toString(),
            lineTotal: item.lineTotal.toString(),
          })),
        }
      : {}),
  };
}
