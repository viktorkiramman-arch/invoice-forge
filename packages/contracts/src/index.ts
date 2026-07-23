import { z } from "zod";

const decimalString = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/,
    "Use a non-negative decimal with up to 15 whole digits and 4 decimal places.",
  );
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.");

export const idSchema = z.string().uuid();
export const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => ["USD", "EUR", "GBP", "JPY", "KWD"].includes(value), "Unsupported currency.");
export const invoiceStatusSchema = z.enum(["DRAFT", "FINALIZED", "PAID", "OVERDUE", "CANCELLED", "VOID"]);
export const taxModeSchema = z.enum(["EXCLUSIVE", "INCLUSIVE"]);
export const discountTypeSchema = z.enum(["PERCENTAGE", "FIXED"]);

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(200),
});

export const businessUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  region: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().max(30).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  taxIdentifier: z.string().trim().max(100).nullable().optional(),
  defaultCurrency: currencySchema,
  timezone: z.string().trim().min(1).max(100),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,12}$/)
    .transform((value) => value.toUpperCase()),
  defaultPaymentTerms: z.string().trim().max(4000).nullable().optional(),
  defaultTaxMode: taxModeSchema,
  logoDataUrl: z.string().max(1_050_000).nullable().optional(),
  version: z.number().int().positive(),
});

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  region: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().max(30).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  taxIdentifier: z.string().trim().max(100).nullable().optional(),
  internalNotes: z.string().trim().max(4000).nullable().optional(),
});

export const customerUpdateSchema = customerInputSchema.extend({
  version: z.number().int().positive(),
});

export const taxRateInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rate: decimalString.refine((value) => Number(value) <= 100, "Tax rate cannot exceed 100%."),
  isDefault: z.boolean().default(false),
});

const discountSchema = z.object({
  type: discountTypeSchema,
  value: decimalString,
});

export const invoiceItemInputSchema = z.object({
  id: idSchema.optional(),
  description: z.string().trim().max(1000),
  quantity: decimalString,
  unitPrice: decimalString,
  discount: discountSchema.nullable().optional(),
  tax: z
    .object({
      name: z.string().trim().min(1).max(100),
      rate: decimalString,
      taxRateId: idSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const invoiceCalculationSchema = z.object({
  currency: currencySchema,
  taxMode: taxModeSchema,
  items: z.array(invoiceItemInputSchema).min(1).max(500),
  invoiceDiscount: discountSchema.nullable().optional(),
});

export const invoiceDraftInputSchema = invoiceCalculationSchema.extend({
  customerId: idSchema.nullable().optional(),
  issueDate: dateString,
  dueDate: dateString,
  purchaseOrderNumber: z.string().trim().max(100).nullable().optional(),
  projectReference: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(8000).nullable().optional(),
  internalNotes: z.string().trim().max(8000).nullable().optional(),
  paymentTerms: z.string().trim().max(4000).nullable().optional(),
});

export const invoiceDraftUpdateSchema = invoiceDraftInputSchema.extend({
  version: z.number().int().positive(),
});

export const finalizeInvoiceSchema = z.object({
  version: z.number().int().positive(),
  customNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,40}$/)
    .nullable()
    .optional(),
});

export const statusUpdateSchema = z.object({
  status: invoiceStatusSchema,
  version: z.number().int().positive(),
  reason: z.string().trim().max(1000).nullable().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type BusinessUpdateInput = z.infer<typeof businessUpdateSchema>;
export type CustomerInput = z.infer<typeof customerInputSchema>;
export type InvoiceDraftInput = z.infer<typeof invoiceDraftInputSchema>;
export type InvoiceDraftUpdateInput = z.infer<typeof invoiceDraftUpdateSchema>;
export type InvoiceCalculationInputContract = z.infer<typeof invoiceCalculationSchema>;
