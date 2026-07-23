# Architecture

## Boundaries

- `packages/domain`: framework-independent calculations and lifecycle state machine.
- `packages/contracts`: Zod request schemas shared by API clients.
- `apps/api`: authentication, authorization, application services, Prisma repositories, transactions and PDF generation.
- `apps/web`: page flows, forms, responsive components and client-side previews.

The browser preview improves interaction, but the API recalculates every saved or finalized invoice.

## Data ownership

Authentication resolves a user session and one active business membership. Protected request handlers derive `businessId` from that membership. IDs received from the browser are never sufficient for access.

## Concurrency

Invoices, customers, tax rates, and business settings have integer versions. Updates require the current version and increment it atomically. Finalization also checks status and version inside a transaction.

## Historical integrity

Finalized invoices store:

- Business snapshot
- Customer snapshot
- Calculation snapshot
- Calculation version
- Permanent number
- Finalization timestamp
- PDF checksum and storage path

Customer and business edits therefore do not rewrite history.

## PDF flow

1. Authorize invoice access.
2. Load current draft or finalized snapshots.
3. Escape all text.
4. Render controlled HTML/CSS.
5. Block network requests in Chromium.
6. Print A4 PDF.
7. Persist finalized output and checksum.
8. Stream the authorized file.
