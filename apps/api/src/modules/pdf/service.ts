import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { getCurrencyScale } from "@invoice-forge/domain";
import { chromium } from "playwright-core";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/prisma.js";
import { loadInvoice } from "../invoices/service.js";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseSnapshot(value: string | null, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}

function addressLines(record: Record<string, unknown>): string[] {
  const locality = [record.city, record.region, record.postalCode].filter(Boolean).join(", ");
  return [record.addressLine1, record.addressLine2, locality, record.country].filter(Boolean).map(String);
}

function currency(value: string, code: string): string {
  const scale = getCurrencyScale(code);
  const fixed = new Prisma.Decimal(value).toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP).toFixed(scale);
  const [integer = "0", fraction] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const amount = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      minimumFractionDigits: scale,
      maximumFractionDigits: scale,
    }).formatToParts(0);
    const symbol = parts.find((part) => part.type === "currency")?.value ?? code;
    const currencyBeforeAmount =
      parts.findIndex((part) => part.type === "currency") < parts.findIndex((part) => part.type === "integer");
    return currencyBeforeAmount ? `${symbol}${amount}` : `${amount} ${symbol}`;
  } catch {
    return `${code} ${amount}`;
  }
}

function date(value: Date): string {
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" }).format(
    value,
  );
}

function invoiceHtml(
  invoice: Awaited<ReturnType<typeof loadInvoice>>,
  businessRecord: Record<string, unknown>,
): string {
  const fallbackCustomer = invoice.customer
    ? {
        name: invoice.customer.name,
        companyName: invoice.customer.companyName,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
        addressLine1: invoice.customer.addressLine1,
        addressLine2: invoice.customer.addressLine2,
        city: invoice.customer.city,
        region: invoice.customer.region,
        postalCode: invoice.customer.postalCode,
        country: invoice.customer.country,
        taxIdentifier: invoice.customer.taxIdentifier,
      }
    : { name: "Unassigned customer" };
  const customer = parseSnapshot(invoice.customerSnapshot, fallbackCustomer);
  const business = parseSnapshot(invoice.businessSnapshot, businessRecord);
  const watermark = invoice.status === "DRAFT" ? "DRAFT" : invoice.status === "VOID" ? "VOID" : "";
  const logo =
    typeof business.logoDataUrl === "string" && business.logoDataUrl.startsWith("data:image/")
      ? `<img class="logo" src="${business.logoDataUrl}" alt="" />`
      : `<div class="logo-fallback">IF</div>`;

  const items = invoice.items
    .map(
      (item) => `
    <tr>
      <td><strong>${escapeHtml(item.description)}</strong></td>
      <td class="number">${escapeHtml(item.quantity.toString())}</td>
      <td class="number">${escapeHtml(currency(item.unitPrice.toString(), invoice.currency))}</td>
      <td class="number">${item.discountAmount.isZero() ? "—" : escapeHtml(currency(item.discountAmount.toString(), invoice.currency))}</td>
      <td class="number">${item.taxRate.isZero() ? "—" : `${escapeHtml(item.taxName ?? "Tax")} ${escapeHtml(item.taxRate.toString())}%`}</td>
      <td class="number"><strong>${escapeHtml(currency(item.lineTotal.toString(), invoice.currency))}</strong></td>
    </tr>`,
    )
    .join("");

  const taxRows = new Map<string, Prisma.Decimal>();
  for (const item of invoice.items) {
    if (item.taxRate.isZero()) continue;
    const key = `${item.taxName ?? "Tax"} ${item.taxRate.toString()}%`;
    taxRows.set(key, (taxRows.get(key) ?? new Prisma.Decimal(0)).plus(item.taxAmount));
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(invoice.number ?? "Draft invoice")}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #0f172a; font-family: Inter, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; }
  .page { position: relative; min-height: 250mm; }
  .watermark { position: fixed; inset: 38% 0 auto; text-align: center; font-size: 76pt; letter-spacing: 0.12em; font-weight: 800; color: rgba(37, 99, 235, .07); transform: rotate(-25deg); z-index: -1; }
  .watermark.void { color: rgba(185, 28, 28, .08); }
  .header { position: relative; display: flex; justify-content: space-between; gap: 32px; border-bottom: 2px solid #2563eb; padding: 5px 0 22px; }
  .header::before { position: absolute; top: -18mm; left: -16mm; width: 58mm; height: 3mm; background: linear-gradient(90deg, #2563eb, #0f766e); content: ""; }
  .brand { display: flex; gap: 14px; align-items: flex-start; }
  .logo { width: 54px; height: 54px; object-fit: contain; }
  .logo-fallback { width: 54px; height: 54px; border-radius: 13px; background: linear-gradient(145deg, #2563eb, #1e40af); box-shadow: 0 5px 14px rgba(37,99,235,.18); color: white; display: grid; place-items: center; font-weight: 800; font-size: 18px; }
  h1, h2, p { margin: 0; }
  h1 { color: #0f172a; font-size: 25pt; letter-spacing: .03em; }
  h2 { font-size: 12pt; margin-bottom: 7px; }
  .muted { color: #64748b; }
  .meta { text-align: right; min-width: 210px; }
  .meta-grid { display: grid; grid-template-columns: 1fr auto; gap: 5px 14px; margin-top: 12px; }
  .meta-grid dt { color: #64748b; }
  .meta-grid dd { margin: 0; font-weight: 600; }
  .status-chip { display: inline-flex; margin-top: 9px; padding: 4px 8px; border: 1px solid #bfdbfe; border-radius: 99px; background: #eff6ff; color: #1d4ed8; font-size: 8pt; font-weight: 700; letter-spacing: .03em; text-transform: capitalize; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 28px 0; }
  .party { border-left: 3px solid #dbeafe; padding-left: 13px; }
  .party:first-child { border-left-color: #5eead4; }
  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; }
  th { background: #eff6ff; color: #1e3a8a; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; text-align: left; padding: 10px 8px; border-bottom: 1px solid #bfdbfe; }
  td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr { break-inside: avoid; }
  .number { text-align: right; white-space: nowrap; }
  .summary-wrap { display: flex; justify-content: flex-end; margin-top: 24px; break-inside: avoid; }
  .summary { width: 310px; }
  .summary-row { display: flex; justify-content: space-between; gap: 18px; padding: 5px 0; }
  .summary-total { margin-top: 8px; padding: 12px 10px; border-top: 2px solid #2563eb; border-radius: 0 0 7px 7px; background: #f8fafc; font-size: 15pt; font-weight: 800; }
  .notes { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 34px; break-inside: avoid; }
  .note-box { min-height: 34px; border-top: 1px solid #cbd5e1; padding-top: 10px; color: #475569; white-space: pre-wrap; }
</style>
</head>
<body>
<div class="page">
  ${watermark ? `<div class="watermark ${invoice.status.toLowerCase()}">${watermark}</div>` : ""}
  <header class="header">
    <div class="brand">
      ${logo}
      <div>
        <h2>${escapeHtml(business.name ?? "Invoice Forge")}</h2>
        ${addressLines(business)
          .map((line) => `<p class="muted">${escapeHtml(line)}</p>`)
          .join("")}
        ${business.email ? `<p class="muted">${escapeHtml(business.email)}</p>` : ""}
        ${business.taxIdentifier ? `<p class="muted">Tax ID: ${escapeHtml(business.taxIdentifier)}</p>` : ""}
      </div>
    </div>
    <div class="meta">
      <h1>INVOICE</h1>
      <div class="status-chip">${escapeHtml(invoice.status.toLowerCase())}</div>
      <dl class="meta-grid">
        <dt>Number</dt><dd>${escapeHtml(invoice.number ?? "Draft")}</dd>
        <dt>Issue date</dt><dd>${escapeHtml(date(invoice.issueDate))}</dd>
        <dt>Due date</dt><dd>${escapeHtml(date(invoice.dueDate))}</dd>
        <dt>Currency</dt><dd>${escapeHtml(invoice.currency)}</dd>
      </dl>
    </div>
  </header>

  <section class="parties">
    <div class="party">
      <h2>Bill to</h2>
      <p><strong>${escapeHtml(customer.companyName || customer.name)}</strong></p>
      ${customer.companyName && customer.name ? `<p>${escapeHtml(customer.name)}</p>` : ""}
      ${addressLines(customer)
        .map((line) => `<p class="muted">${escapeHtml(line)}</p>`)
        .join("")}
      ${customer.email ? `<p class="muted">${escapeHtml(customer.email)}</p>` : ""}
    </div>
    <div class="party">
      <h2>Reference</h2>
      ${invoice.projectReference ? `<p><span class="muted">Project:</span> ${escapeHtml(invoice.projectReference)}</p>` : ""}
      ${invoice.purchaseOrderNumber ? `<p><span class="muted">PO:</span> ${escapeHtml(invoice.purchaseOrderNumber)}</p>` : ""}
      <p><span class="muted">Status:</span> ${escapeHtml(invoice.status)}</p>
    </div>
  </section>

  <table aria-label="Invoice line items">
    <thead><tr><th>Description</th><th class="number">Quantity</th><th class="number">Unit price</th><th class="number">Discount</th><th class="number">Tax</th><th class="number">Amount</th></tr></thead>
    <tbody>${items}</tbody>
  </table>

  <div class="summary-wrap"><div class="summary">
    <div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(currency(invoice.itemsSubtotal.toString(), invoice.currency))}</strong></div>
    ${invoice.discountTotal.isZero() ? "" : `<div class="summary-row"><span>Discounts</span><strong>−${escapeHtml(currency(invoice.discountTotal.toString(), invoice.currency))}</strong></div>`}
    ${[...taxRows.entries()].map(([name, amount]) => `<div class="summary-row"><span>${escapeHtml(name)}</span><strong>${escapeHtml(currency(amount.toString(), invoice.currency))}</strong></div>`).join("")}
    <div class="summary-row summary-total"><span>Total</span><span>${escapeHtml(currency(invoice.grandTotal.toString(), invoice.currency))}</span></div>
  </div></div>

  <section class="notes">
    <div><h2>Notes</h2><div class="note-box">${escapeHtml(invoice.notes || "—")}</div></div>
    <div><h2>Payment terms</h2><div class="note-box">${escapeHtml(invoice.paymentTerms || "—")}</div></div>
  </section>

</div>
</body>
</html>`;
}

export async function generateInvoicePdf(invoiceId: string, businessId: string): Promise<Buffer> {
  const [invoice, business] = await Promise.all([
    loadInvoice(invoiceId, businessId),
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
  ]);

  const browser = await chromium.launch({
    headless: true,
    ...(env.chromiumPath ? { executablePath: env.chromiumPath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url === "about:blank") await route.continue();
      else await route.abort();
    });
    await page.setContent(invoiceHtml(invoice, business as unknown as Record<string, unknown>), {
      waitUntil: "load",
      timeout: 15_000,
    });
    await page.emulateMedia({ media: "print" });
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;padding:0 16mm;font:8px Arial;color:#64748b;display:flex;justify-content:space-between;"><span>${escapeHtml(invoice.number ?? "Draft invoice")}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}

export async function getOrCreateInvoicePdf(
  invoiceId: string,
  businessId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const invoice = await loadInvoice(invoiceId, businessId);
  if (invoice.status === "CANCELLED") {
    throw Object.assign(new Error("Cancelled drafts do not have a PDF."), { statusCode: 409, code: "PDF_UNAVAILABLE" });
  }
  const filename = `${invoice.number ?? "draft-invoice"}.pdf`.replace(/[^A-Za-z0-9_.-]/g, "-");

  if (invoice.status !== "DRAFT" && invoice.pdfPath) {
    try {
      return { buffer: await readFile(invoice.pdfPath), filename };
    } catch {
      // Regenerate from immutable snapshots when the stored object is unavailable.
    }
  }

  const buffer = await generateInvoicePdf(invoiceId, businessId);

  if (invoice.status !== "DRAFT") {
    await mkdir(env.pdfStorageDir, { recursive: true });
    const filePath = path.join(env.pdfStorageDir, `${invoice.id}.pdf`);
    await writeFile(filePath, buffer);
    await prisma.invoice.updateMany({
      where: {
        id: invoice.id,
        businessId,
        status: invoice.status,
        version: invoice.version,
        deletedAt: null,
      },
      data: { pdfPath: filePath, pdfChecksum: createHash("sha256").update(buffer).digest("hex") },
    });
  }

  return { buffer, filename };
}
