import { createHash, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { calculateInvoice, type InvoiceCalculationInput } from "../packages/domain/src/index.js";

const prisma = new PrismaClient();

function passwordHash(password: string): string {
  const salt = "invoice-forge-demo";
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function createInvoice(args: {
  businessId: string;
  customerId: string;
  userId: string;
  number?: string;
  status: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  paymentTerms?: string;
  projectReference?: string;
  input: InvoiceCalculationInput;
}) {
  const calculation = calculateInvoice(args.input);
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: args.customerId } });
  const business = await prisma.business.findUniqueOrThrow({ where: { id: args.businessId } });
  const final = args.status !== "DRAFT";

  return prisma.invoice.create({
    data: {
      businessId: args.businessId,
      customerId: args.customerId,
      number: args.number ?? null,
      status: args.status,
      currency: args.input.currency,
      taxMode: args.input.taxMode,
      issueDate: date(args.issueDate),
      dueDate: date(args.dueDate),
      projectReference: args.projectReference ?? null,
      notes: args.notes ?? null,
      paymentTerms: args.paymentTerms ?? "Payment due within 14 days by bank transfer.",
      itemsSubtotal: calculation.itemsSubtotal,
      lineDiscountTotal: calculation.lineDiscountTotal,
      invoiceDiscountType: args.input.invoiceDiscount?.type ?? null,
      invoiceDiscountValue: args.input.invoiceDiscount?.value ?? null,
      invoiceDiscountTotal: calculation.invoiceDiscountTotal,
      discountTotal: calculation.discountTotal,
      netSubtotal: calculation.netSubtotal,
      taxTotal: calculation.taxTotal,
      grandTotal: calculation.grandTotal,
      calculationVersion: calculation.calculationVersion,
      calculationSnapshot: final ? JSON.stringify(calculation) : null,
      calculationChecksum: final ? createHash("sha256").update(JSON.stringify(calculation)).digest("hex") : null,
      businessSnapshot: final
        ? JSON.stringify({
            name: business.name,
            legalName: business.legalName,
            email: business.email,
            phone: business.phone,
            addressLine1: business.addressLine1,
            city: business.city,
            region: business.region,
            postalCode: business.postalCode,
            country: business.country,
            taxIdentifier: business.taxIdentifier,
            logoDataUrl: business.logoDataUrl,
          })
        : null,
      customerSnapshot: final
        ? JSON.stringify({
            name: customer.name,
            companyName: customer.companyName,
            email: customer.email,
            addressLine1: customer.addressLine1,
            city: customer.city,
            region: customer.region,
            postalCode: customer.postalCode,
            country: customer.country,
          })
        : null,
      finalizedAt: final ? new Date() : null,
      items: {
        create: calculation.items.map((item, position) => ({
          position,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          baseAmount: item.baseAmount,
          discountType: args.input.items[position]?.discount?.type ?? null,
          discountValue: args.input.items[position]?.discount?.value ?? null,
          discountAmount: item.discountAmount,
          allocatedInvoiceDiscount: item.allocatedInvoiceDiscount,
          taxableAmount: item.taxableAmount,
          taxName: item.taxName,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          lineTotal: item.lineTotal,
        })),
      },
      events: {
        create: final
          ? [
              { businessId: args.businessId, actorUserId: args.userId, eventType: "INVOICE_CREATED" },
              {
                businessId: args.businessId,
                actorUserId: args.userId,
                eventType: "INVOICE_FINALIZED",
                previousStatus: "DRAFT",
                newStatus: "FINALIZED",
                metadata: JSON.stringify({ number: args.number }),
              },
              ...(args.status !== "FINALIZED"
                ? [
                    {
                      businessId: args.businessId,
                      actorUserId: args.userId,
                      eventType: "STATUS_CHANGED",
                      previousStatus: "FINALIZED",
                      newStatus: args.status,
                    },
                  ]
                : []),
            ]
          : [{ businessId: args.businessId, actorUserId: args.userId, eventType: "INVOICE_CREATED" }],
      },
    },
  });
}

async function main() {
  await prisma.invoiceEvent.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.invoiceSequence.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.session.deleteMany();
  await prisma.businessMembership.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: "demo@invoiceforge.local", displayName: "Alex Morgan", passwordHash: passwordHash("demo1234") },
  });
  const business = await prisma.business.create({
    data: {
      name: "Northstar Studio",
      legalName: "Northstar Studio LLC",
      email: "billing@northstar.example",
      phone: "+1 555 010 2200",
      addressLine1: "125 Market Street",
      city: "Portland",
      region: "OR",
      postalCode: "97205",
      country: "United States",
      taxIdentifier: "US-NS-2048",
      defaultCurrency: "USD",
      timezone: "America/Los_Angeles",
      invoicePrefix: "NS-INV",
      defaultPaymentTerms: "Payment due within 14 days by bank transfer.",
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const [acme, harbor, linden, bright] = await Promise.all([
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: "Maya Chen",
        companyName: "Acme Design Co.",
        email: "maya@acme.example",
        addressLine1: "88 Mission Ave",
        city: "San Francisco",
        region: "CA",
        postalCode: "94105",
        country: "United States",
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: "Daniel Harbor",
        companyName: "Harbor Legal Consulting",
        email: "daniel@harbor.example",
        addressLine1: "16 Court Square",
        city: "Boston",
        region: "MA",
        postalCode: "02108",
        country: "United States",
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: "Linden Community Group",
        email: "accounts@linden.example",
        addressLine1: "42 Grove Road",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "United States",
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: "Priya Raman",
        companyName: "Bright Peak Research and Applied Systems Laboratory",
        email: "priya@brightpeak.example",
        addressLine1: "500 Innovation Boulevard, Building 4",
        city: "Seattle",
        region: "WA",
        postalCode: "98101",
        country: "United States",
      },
    }),
  ]);

  await prisma.taxRate.createMany({
    data: [
      { businessId: business.id, name: "Sales tax", rate: "7.125", isDefault: true },
      { businessId: business.id, name: "VAT", rate: "10" },
      { businessId: business.id, name: "Reduced tax", rate: "5" },
    ],
  });

  await createInvoice({
    businessId: business.id,
    customerId: acme.id,
    userId: user.id,
    number: "NS-INV-2026-0001",
    status: "PAID",
    issueDate: "2026-06-05",
    dueDate: "2026-06-19",
    projectReference: "Brand system consultation",
    input: {
      currency: "USD",
      taxMode: "EXCLUSIVE",
      items: [
        {
          description: "Brand strategy workshop",
          quantity: "1",
          unitPrice: "1200",
          tax: { name: "Sales tax", rate: "7.125" },
        },
        {
          description: "Design system consultation",
          quantity: "8",
          unitPrice: "150",
          discount: { type: "PERCENTAGE", value: "10" },
          tax: { name: "Sales tax", rate: "7.125" },
        },
      ],
    },
  });

  await createInvoice({
    businessId: business.id,
    customerId: harbor.id,
    userId: user.id,
    number: "NS-INV-2026-0002",
    status: "OVERDUE",
    issueDate: "2026-05-10",
    dueDate: "2026-05-24",
    projectReference: "Client portal discovery",
    input: {
      currency: "USD",
      taxMode: "EXCLUSIVE",
      items: [
        {
          description: "Product discovery and requirements",
          quantity: "18.5",
          unitPrice: "175",
          tax: { name: "Reduced tax", rate: "5" },
        },
      ],
      invoiceDiscount: { type: "FIXED", value: "250" },
    },
  });

  await createInvoice({
    businessId: business.id,
    customerId: linden.id,
    userId: user.id,
    status: "DRAFT",
    issueDate: "2026-07-20",
    dueDate: "2026-08-03",
    notes: "Thank you for supporting local community programs.",
    input: {
      currency: "USD",
      taxMode: "EXCLUSIVE",
      items: [
        { description: "Website accessibility audit", quantity: "1", unitPrice: "900" },
        { description: "Remediation planning", quantity: "4", unitPrice: "120" },
      ],
    },
  });

  await createInvoice({
    businessId: business.id,
    customerId: bright.id,
    userId: user.id,
    number: "NS-INV-2026-0003",
    status: "FINALIZED",
    issueDate: "2026-07-18",
    dueDate: "2026-08-01",
    projectReference: "Research documentation program",
    notes: "This invoice contains a long item list to demonstrate multi-page PDF handling.",
    input: {
      currency: "USD",
      taxMode: "INCLUSIVE",
      items: Array.from({ length: 38 }, (_, index) => ({
        description: `Research documentation package ${String(index + 1).padStart(2, "0")} — analysis, editorial review, and delivery`,
        quantity: "1",
        unitPrice: String(95 + (index % 4) * 10),
        tax: { name: "VAT", rate: "10" },
      })),
      invoiceDiscount: { type: "PERCENTAGE", value: "3" },
    },
  });

  await prisma.invoiceSequence.create({ data: { businessId: business.id, year: 2026, lastValue: 3 } });
  console.log("Seeded demo account: demo@invoiceforge.local / demo1234");
}

main().finally(() => prisma.$disconnect());
