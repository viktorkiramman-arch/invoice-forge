import { Decimal } from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const invoiceStatuses = ["DRAFT", "FINALIZED", "PAID", "OVERDUE", "CANCELLED", "VOID"] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];
export type DiscountType = "PERCENTAGE" | "FIXED";
export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

export interface DiscountInput {
  type: DiscountType;
  value: string;
}

export interface TaxInput {
  name: string;
  rate: string;
}

export interface InvoiceItemInput {
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount?: DiscountInput | null;
  tax?: TaxInput | null;
}

export interface InvoiceCalculationInput {
  currency: string;
  currencyScale?: number;
  taxMode: TaxMode;
  items: InvoiceItemInput[];
  invoiceDiscount?: DiscountInput | null;
}

export interface CalculatedInvoiceItem {
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  baseAmount: string;
  discountAmount: string;
  allocatedInvoiceDiscount: string;
  taxableAmount: string;
  taxName: string | null;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
}

export interface InvoiceCalculationResult {
  currency: string;
  currencyScale: number;
  taxMode: TaxMode;
  items: CalculatedInvoiceItem[];
  itemsSubtotal: string;
  lineDiscountTotal: string;
  invoiceDiscountTotal: string;
  discountTotal: string;
  netSubtotal: string;
  taxTotal: string;
  grandTotal: string;
  taxBreakdown: Array<{ name: string; rate: string; amount: string }>;
  calculationVersion: "1.0.0";
}

export class InvoiceDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InvoiceDomainError";
  }
}

const currencyScales: Readonly<Record<string, number>> = {
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  CLP: 0,
  JPY: 0,
  KRW: 0,
  VND: 0,
};

export function getCurrencyScale(currency: string): number {
  return currencyScales[currency.toUpperCase()] ?? 2;
}

function parseDecimal(value: string, field: string): Decimal {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new InvoiceDomainError("INVALID_DECIMAL", `${field} must be a plain non-negative decimal.`);
  }

  const result = new Decimal(value);
  if (!result.isFinite() || result.isNegative()) {
    throw new InvoiceDomainError("INVALID_DECIMAL", `${field} must be a finite non-negative decimal.`);
  }
  return result;
}

function rounded(value: Decimal, scale: number): Decimal {
  return value.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
}

function fixed(value: Decimal, scale: number): string {
  return rounded(value, scale).toFixed(scale);
}

function validatePrecision(value: Decimal, maximum: number, field: string): void {
  if (value.decimalPlaces() > maximum) {
    throw new InvoiceDomainError("TOO_PRECISE", `${field} supports at most ${maximum} decimal places.`);
  }
}

function calculateDiscount(base: Decimal, discount: DiscountInput | null | undefined, scale: number): Decimal {
  if (!discount) return new Decimal(0);

  const value = parseDecimal(discount.value, "Discount");
  validatePrecision(value, 4, "Discount");

  const amount = discount.type === "PERCENTAGE" ? base.mul(value).div(100) : value;

  const result = rounded(amount, scale);
  if (result.gt(base)) {
    throw new InvoiceDomainError("DISCOUNT_EXCEEDS_BASE", "Discount cannot exceed the applicable amount.");
  }
  return result;
}

function allocateProportionally(total: Decimal, bases: Decimal[], scale: number): Decimal[] {
  if (total.isZero()) return bases.map(() => new Decimal(0));

  const baseTotal = Decimal.sum(...bases);
  if (baseTotal.isZero()) {
    throw new InvoiceDomainError("INVALID_DISCOUNT_BASE", "A discount cannot be allocated across zero-value items.");
  }

  const unit = new Decimal(1).div(new Decimal(10).pow(scale));
  const raw = bases.map((base) => total.mul(base).div(baseTotal));
  const allocated = raw.map((share) => share.toDecimalPlaces(scale, Decimal.ROUND_DOWN));
  const remainingUnits = rounded(total.minus(Decimal.sum(...allocated)), scale)
    .div(unit)
    .toNumber();

  const ranked = raw
    .map((share, index) => ({ index, remainder: share.minus(allocated[index] ?? 0) }))
    .sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);

  for (let index = 0; index < remainingUnits; index += 1) {
    const target = ranked[index % ranked.length];
    if (target) allocated[target.index] = (allocated[target.index] ?? new Decimal(0)).plus(unit);
  }

  return allocated.map((amount) => rounded(amount, scale));
}

export function calculateInvoice(input: InvoiceCalculationInput): InvoiceCalculationResult {
  if (input.items.length === 0) {
    throw new InvoiceDomainError("EMPTY_INVOICE", "An invoice must contain at least one item.");
  }

  const scale = input.currencyScale ?? getCurrencyScale(input.currency);
  if (!Number.isInteger(scale) || scale < 0 || scale > 4) {
    throw new InvoiceDomainError("INVALID_CURRENCY_SCALE", "Currency scale must be between zero and four.");
  }

  const prepared = input.items.map((item, index) => {
    const quantity = parseDecimal(item.quantity, `Item ${index + 1} quantity`);
    const unitPrice = parseDecimal(item.unitPrice, `Item ${index + 1} unit price`);
    validatePrecision(quantity, 4, `Item ${index + 1} quantity`);
    validatePrecision(unitPrice, 4, `Item ${index + 1} unit price`);

    if (quantity.lte(0)) {
      throw new InvoiceDomainError("INVALID_QUANTITY", `Item ${index + 1} quantity must be greater than zero.`);
    }

    const baseAmount = rounded(quantity.mul(unitPrice), scale);
    const discountAmount = calculateDiscount(baseAmount, item.discount, scale);
    const discountedAmount = baseAmount.minus(discountAmount);

    let taxRate = new Decimal(0);
    if (item.tax) {
      taxRate = parseDecimal(item.tax.rate, `Item ${index + 1} tax rate`);
      validatePrecision(taxRate, 4, `Item ${index + 1} tax rate`);
      if (taxRate.gt(100)) {
        throw new InvoiceDomainError("INVALID_TAX_RATE", "Tax rate cannot exceed 100%.");
      }
    }

    return { item, quantity, unitPrice, baseAmount, discountAmount, discountedAmount, taxRate };
  });

  const itemsSubtotal = rounded(Decimal.sum(...prepared.map((row) => row.baseAmount)), scale);
  const lineDiscountTotal = rounded(Decimal.sum(...prepared.map((row) => row.discountAmount)), scale);
  const postLineDiscountSubtotal = rounded(Decimal.sum(...prepared.map((row) => row.discountedAmount)), scale);
  const invoiceDiscountTotal = calculateDiscount(postLineDiscountSubtotal, input.invoiceDiscount, scale);
  const allocations = allocateProportionally(
    invoiceDiscountTotal,
    prepared.map((row) => row.discountedAmount),
    scale,
  );

  const taxGroups = new Map<string, { name: string; rate: string; amount: Decimal }>();

  const items = prepared.map((row, index): CalculatedInvoiceItem => {
    const allocatedInvoiceDiscount = allocations[index] ?? new Decimal(0);
    const discountedGross = rounded(row.discountedAmount.minus(allocatedInvoiceDiscount), scale);
    const rateFraction = row.taxRate.div(100);

    let taxableAmount = discountedGross;
    let taxAmount = new Decimal(0);
    let lineTotal = discountedGross;

    if (!row.taxRate.isZero()) {
      if (input.taxMode === "EXCLUSIVE") {
        taxAmount = rounded(discountedGross.mul(rateFraction), scale);
        lineTotal = rounded(discountedGross.plus(taxAmount), scale);
      } else {
        taxAmount = rounded(discountedGross.minus(discountedGross.div(new Decimal(1).plus(rateFraction))), scale);
        taxableAmount = rounded(discountedGross.minus(taxAmount), scale);
      }

      const name = row.item.tax?.name.trim() || "Tax";
      const key = `${name}:${row.taxRate.toString()}`;
      const existing = taxGroups.get(key);
      taxGroups.set(key, {
        name,
        rate: row.taxRate.toString(),
        amount: (existing?.amount ?? new Decimal(0)).plus(taxAmount),
      });
    }

    return {
      ...(row.item.id ? { id: row.item.id } : {}),
      description: row.item.description,
      quantity: row.quantity.toString(),
      unitPrice: row.unitPrice.toString(),
      baseAmount: fixed(row.baseAmount, scale),
      discountAmount: fixed(row.discountAmount, scale),
      allocatedInvoiceDiscount: fixed(allocatedInvoiceDiscount, scale),
      taxableAmount: fixed(taxableAmount, scale),
      taxName: row.item.tax?.name.trim() || null,
      taxRate: row.taxRate.toString(),
      taxAmount: fixed(taxAmount, scale),
      lineTotal: fixed(lineTotal, scale),
    };
  });

  const invoiceDiscountAllocated = rounded(Decimal.sum(...allocations), scale);
  if (!invoiceDiscountAllocated.eq(invoiceDiscountTotal)) {
    throw new InvoiceDomainError(
      "ALLOCATION_MISMATCH",
      "Allocated invoice discounts do not match the invoice discount.",
    );
  }

  const discountTotal = rounded(lineDiscountTotal.plus(invoiceDiscountTotal), scale);
  const taxTotal = rounded(Decimal.sum(...items.map((item) => new Decimal(item.taxAmount))), scale);
  const discountedSubtotal = rounded(itemsSubtotal.minus(discountTotal), scale);
  const netSubtotal =
    input.taxMode === "INCLUSIVE" ? rounded(discountedSubtotal.minus(taxTotal), scale) : discountedSubtotal;
  const grandTotal =
    input.taxMode === "EXCLUSIVE" ? rounded(discountedSubtotal.plus(taxTotal), scale) : discountedSubtotal;

  if (grandTotal.isNegative()) {
    throw new InvoiceDomainError("NEGATIVE_TOTAL", "Invoice total cannot be negative.");
  }

  return {
    currency: input.currency.toUpperCase(),
    currencyScale: scale,
    taxMode: input.taxMode,
    items,
    itemsSubtotal: fixed(itemsSubtotal, scale),
    lineDiscountTotal: fixed(lineDiscountTotal, scale),
    invoiceDiscountTotal: fixed(invoiceDiscountTotal, scale),
    discountTotal: fixed(discountTotal, scale),
    netSubtotal: fixed(netSubtotal, scale),
    taxTotal: fixed(taxTotal, scale),
    grandTotal: fixed(grandTotal, scale),
    taxBreakdown: [...taxGroups.values()]
      .map((group) => ({ ...group, amount: fixed(group.amount, scale) }))
      .sort((a, b) => a.name.localeCompare(b.name) || new Decimal(a.rate).comparedTo(b.rate)),
    calculationVersion: "1.0.0",
  };
}

const allowedTransitions: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  DRAFT: ["FINALIZED", "CANCELLED"],
  FINALIZED: ["PAID", "OVERDUE", "VOID"],
  OVERDUE: ["PAID", "VOID"],
  PAID: ["VOID"],
  CANCELLED: [],
  VOID: [],
};

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransitionInvoice(from, to)) {
    throw new InvoiceDomainError("INVALID_STATUS_TRANSITION", `Invoice cannot transition from ${from} to ${to}.`);
  }
}
