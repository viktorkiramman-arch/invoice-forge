PRAGMA foreign_keys=OFF;

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE TABLE "Business" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCode" TEXT,
  "country" TEXT,
  "taxIdentifier" TEXT,
  "logoDataUrl" TEXT,
  "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
  "defaultPaymentTerms" TEXT,
  "defaultTaxMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "deletedAt" DATETIME
);

CREATE TABLE "BusinessMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'OWNER',
  "permissions" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BusinessMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BusinessMembership_userId_businessId_key" ON "BusinessMembership"("userId", "businessId");
CREATE INDEX "BusinessMembership_businessId_role_idx" ON "BusinessMembership"("businessId", "role");

CREATE TABLE "InvoiceSequence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InvoiceSequence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InvoiceSequence_businessId_year_key" ON "InvoiceSequence"("businessId", "year");

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "companyName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCode" TEXT,
  "country" TEXT,
  "taxIdentifier" TEXT,
  "internalNotes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "archivedAt" DATETIME,
  "deletedAt" DATETIME,
  CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Customer_businessId_name_idx" ON "Customer"("businessId", "name");
CREATE INDEX "Customer_businessId_email_idx" ON "Customer"("businessId", "email");
CREATE INDEX "Customer_businessId_archivedAt_idx" ON "Customer"("businessId", "archivedAt");

CREATE TABLE "TaxRate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rate" DECIMAL NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "archivedAt" DATETIME,
  CONSTRAINT "TaxRate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaxRate_businessId_name_key" ON "TaxRate"("businessId", "name");
CREATE INDEX "TaxRate_businessId_isActive_idx" ON "TaxRate"("businessId", "isActive");

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT,
  "duplicatedFromInvoiceId" TEXT,
  "number" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "taxMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
  "issueDate" DATETIME NOT NULL,
  "dueDate" DATETIME NOT NULL,
  "purchaseOrderNumber" TEXT,
  "projectReference" TEXT,
  "notes" TEXT,
  "internalNotes" TEXT,
  "paymentTerms" TEXT,
  "itemsSubtotal" DECIMAL NOT NULL DEFAULT 0,
  "lineDiscountTotal" DECIMAL NOT NULL DEFAULT 0,
  "invoiceDiscountType" TEXT,
  "invoiceDiscountValue" DECIMAL,
  "invoiceDiscountTotal" DECIMAL NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL NOT NULL DEFAULT 0,
  "netSubtotal" DECIMAL NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL NOT NULL DEFAULT 0,
  "businessSnapshot" TEXT,
  "customerSnapshot" TEXT,
  "calculationSnapshot" TEXT,
  "calculationChecksum" TEXT,
  "calculationVersion" TEXT NOT NULL DEFAULT '1.0.0',
  "pdfPath" TEXT,
  "pdfChecksum" TEXT,
  "finalizedAt" DATETIME,
  "cancelledAt" DATETIME,
  "voidedAt" DATETIME,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "deletedAt" DATETIME,
  CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_duplicatedFromInvoiceId_fkey" FOREIGN KEY ("duplicatedFromInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invoice_businessId_number_key" ON "Invoice"("businessId", "number");
CREATE INDEX "Invoice_businessId_status_idx" ON "Invoice"("businessId", "status");
CREATE INDEX "Invoice_businessId_issueDate_idx" ON "Invoice"("businessId", "issueDate");
CREATE INDEX "Invoice_businessId_dueDate_idx" ON "Invoice"("businessId", "dueDate");
CREATE INDEX "Invoice_businessId_customerId_idx" ON "Invoice"("businessId", "customerId");
CREATE INDEX "Invoice_businessId_number_idx" ON "Invoice"("businessId", "number");

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL NOT NULL,
  "unitPrice" DECIMAL NOT NULL,
  "baseAmount" DECIMAL NOT NULL,
  "discountType" TEXT,
  "discountValue" DECIMAL,
  "discountAmount" DECIMAL NOT NULL,
  "allocatedInvoiceDiscount" DECIMAL NOT NULL,
  "taxableAmount" DECIMAL NOT NULL,
  "taxRateId" TEXT,
  "taxName" TEXT,
  "taxRate" DECIMAL NOT NULL,
  "taxAmount" DECIMAL NOT NULL,
  "lineTotal" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InvoiceItem_invoiceId_position_key" ON "InvoiceItem"("invoiceId", "position");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

CREATE TABLE "InvoiceEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "requestId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InvoiceEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "InvoiceEvent_invoiceId_createdAt_idx" ON "InvoiceEvent"("invoiceId", "createdAt");
CREATE INDEX "InvoiceEvent_businessId_createdAt_idx" ON "InvoiceEvent"("businessId", "createdAt");

PRAGMA foreign_keys=ON;
