export interface UserSession {
  user: {
    id: string;
    email: string;
    displayName: string;
    memberships: Array<{ role: string; business: { id: string; name: string } }>;
  };
}

export interface Business {
  id: string;
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
  defaultCurrency: string;
  timezone: string;
  invoicePrefix: string;
  defaultPaymentTerms: string | null;
  defaultTaxMode: "EXCLUSIVE" | "INCLUSIVE";
  version: number;
}

export interface Customer {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  taxIdentifier: string | null;
  internalNotes: string | null;
  archivedAt: string | null;
  version: number;
  _count?: { invoices: number };
}

export interface TaxRate {
  id: string;
  name: string;
  rate: string;
  isDefault: boolean;
}

export interface InvoiceItem {
  id: string;
  position: number;
  description: string;
  quantity: string;
  unitPrice: string;
  baseAmount: string;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: string | null;
  discountAmount: string;
  allocatedInvoiceDiscount: string;
  taxableAmount: string;
  taxRateId: string | null;
  taxName: string | null;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
}

export interface InvoiceSummary {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  grandTotal: string;
  version: number;
  customer: { id?: string; name: string; companyName: string | null } | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  customerId: string | null;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  purchaseOrderNumber: string | null;
  projectReference: string | null;
  notes: string | null;
  internalNotes: string | null;
  paymentTerms: string | null;
  itemsSubtotal: string;
  lineDiscountTotal: string;
  invoiceDiscountType: "PERCENTAGE" | "FIXED" | null;
  invoiceDiscountValue: string | null;
  invoiceDiscountTotal: string;
  discountTotal: string;
  netSubtotal: string;
  taxTotal: string;
  items: InvoiceItem[];
  events: Array<{
    id: string;
    eventType: string;
    previousStatus: string | null;
    newStatus: string | null;
    metadata: unknown;
    createdAt: string;
    actorName: string;
  }>;
}

export interface InvoiceListResponse {
  items: InvoiceSummary[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface DashboardData {
  summaries: Array<{ status: string; currency: string; count: number; total: string }>;
  recent: Array<{
    id: string;
    number: string | null;
    status: string;
    currency: string;
    total: string;
    dueDate: string;
    customer: { name: string; companyName: string | null } | null;
  }>;
}
