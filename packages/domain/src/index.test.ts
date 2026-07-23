import { describe, expect, it } from "vitest";
import { assertInvoiceTransition, calculateInvoice } from "./index.js";

describe("invoice calculations", () => {
  it("calculates exclusive tax after discounts", () => {
    const result = calculateInvoice({
      currency: "USD",
      taxMode: "EXCLUSIVE",
      items: [
        {
          description: "Consulting",
          quantity: "2",
          unitPrice: "100",
          discount: { type: "PERCENTAGE", value: "10" },
          tax: { name: "VAT", rate: "10" },
        },
      ],
      invoiceDiscount: { type: "FIXED", value: "30" },
    });

    expect(result.itemsSubtotal).toBe("200.00");
    expect(result.discountTotal).toBe("50.00");
    expect(result.taxTotal).toBe("15.00");
    expect(result.grandTotal).toBe("165.00");
  });

  it("extracts inclusive tax without increasing the gross total", () => {
    const result = calculateInvoice({
      currency: "USD",
      taxMode: "INCLUSIVE",
      items: [
        {
          description: "Subscription",
          quantity: "1",
          unitPrice: "110",
          tax: { name: "VAT", rate: "10" },
        },
      ],
    });

    expect(result.taxTotal).toBe("10.00");
    expect(result.grandTotal).toBe("110.00");
    expect(result.netSubtotal).toBe("100.00");
    expect(result.items[0]?.taxableAmount).toBe("100.00");
  });

  it("allocates a fixed invoice discount without losing cents", () => {
    const result = calculateInvoice({
      currency: "USD",
      taxMode: "EXCLUSIVE",
      items: ["10.00", "10.00", "10.00"].map((unitPrice, index) => ({
        description: `Item ${index + 1}`,
        quantity: "1",
        unitPrice,
      })),
      invoiceDiscount: { type: "FIXED", value: "1.00" },
    });

    expect(result.invoiceDiscountTotal).toBe("1.00");
    expect(result.items.map((item) => item.allocatedInvoiceDiscount)).toEqual(["0.34", "0.33", "0.33"]);
    expect(result.grandTotal).toBe("29.00");
  });

  it("supports zero-decimal currencies", () => {
    const result = calculateInvoice({
      currency: "JPY",
      taxMode: "EXCLUSIVE",
      items: [{ description: "Work", quantity: "1", unitPrice: "100.4" }],
    });

    expect(result.itemsSubtotal).toBe("100");
  });

  it("rounds three-decimal currencies at the currency boundary", () => {
    const result = calculateInvoice({
      currency: "BHD",
      taxMode: "EXCLUSIVE",
      items: [{ description: "Work", quantity: "1", unitPrice: "1.2345" }],
    });

    expect(result.itemsSubtotal).toBe("1.235");
    expect(result.grandTotal).toBe("1.235");
  });

  it("rejects decimal precision beyond the supported input scale", () => {
    expect(() =>
      calculateInvoice({
        currency: "USD",
        taxMode: "EXCLUSIVE",
        items: [{ description: "Work", quantity: "1.00001", unitPrice: "100" }],
      }),
    ).toThrow(/at most 4 decimal places/i);
  });

  it("rejects tax rates above one hundred percent", () => {
    expect(() =>
      calculateInvoice({
        currency: "USD",
        taxMode: "EXCLUSIVE",
        items: [
          {
            description: "Work",
            quantity: "1",
            unitPrice: "100",
            tax: { name: "Invalid tax", rate: "100.0001" },
          },
        ],
      }),
    ).toThrow(/cannot exceed 100%/i);
  });

  it("rejects exponent notation and discounts above the line amount", () => {
    expect(() =>
      calculateInvoice({
        currency: "USD",
        taxMode: "EXCLUSIVE",
        items: [{ description: "Work", quantity: "1e2", unitPrice: "1" }],
      }),
    ).toThrow(/plain non-negative decimal/i);

    expect(() =>
      calculateInvoice({
        currency: "USD",
        taxMode: "EXCLUSIVE",
        items: [
          {
            description: "Work",
            quantity: "1",
            unitPrice: "10",
            discount: { type: "FIXED", value: "10.01" },
          },
        ],
      }),
    ).toThrow(/cannot exceed/i);
  });
});

describe("invoice lifecycle", () => {
  it("allows finalization and rejects reopening a paid invoice", () => {
    expect(() => assertInvoiceTransition("DRAFT", "FINALIZED")).not.toThrow();
    expect(() => assertInvoiceTransition("PAID", "DRAFT")).toThrow(/cannot transition/i);
  });

  it("allows controlled corrections and keeps terminal states closed", () => {
    expect(() => assertInvoiceTransition("FINALIZED", "VOID")).not.toThrow();
    expect(() => assertInvoiceTransition("OVERDUE", "PAID")).not.toThrow();
    expect(() => assertInvoiceTransition("CANCELLED", "DRAFT")).toThrow(/cannot transition/i);
    expect(() => assertInvoiceTransition("VOID", "PAID")).toThrow(/cannot transition/i);
  });
});
