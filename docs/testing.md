# Testing strategy

## Automated verification

Run the complete local suite in this order:

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Unit tests

The domain suite covers exclusive and inclusive taxes, discounts, largest-remainder allocation, currency rounding, input precision, and allowed or rejected lifecycle transitions. API unit tests verify password hashing behavior.

## End-to-end test

The Playwright workflow uses a unique tenant and verifies:

- Registration, sign-out, and sign-in
- Empty-workspace tenant isolation
- Business settings and tax-rate configuration
- Customer create, edit, archive, and restore
- Draft create, save, edit, and recalculation
- Draft PDF preview and finalized PDF download
- Transactional invoice numbering
- Finalized-invoice immutability
- Mark paid, duplicate, cancel, and void transitions
- Invoice search, status filtering, and sorting

The test starts the local application when needed and uses Playwright-managed Chromium unless `CHROMIUM_PATH` is set.

## Manual responsive review

Before a UI release, inspect dashboard, history, customers, settings, invoice editor, invoice detail, and PDF output at desktop and narrow mobile widths. Confirm keyboard focus visibility, menu operation, labels, touch targets, non-color status text, error feedback, empty states, and horizontal overflow.

## Additional production assurance

For a hosted billing product, add integration tests against the production database engine, concurrency tests for simultaneous finalization, PDF text/page-count fixtures, accessibility automation, backup restoration drills, and external penetration testing.
