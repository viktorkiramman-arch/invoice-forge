# Security notes

## Implemented

- HTTP-only, SameSite session cookie
- Secure cookie flag in production
- Scrypt password hashing
- Session token hashing in storage
- Tenant-scoped record queries
- Zod request validation
- Decimal-string validation
- Prisma parameterized queries
- Allowlisted search and status inputs
- Optimistic locking
- Rate limiting
- Helmet security headers
- CORS restricted to configured web origin
- Escaped PDF fields
- External PDF resources blocked
- Data-URI logo type and size checks
- Internal notes excluded from PDF and customer snapshots
- Generic public 500 errors with request IDs

## Production hardening

- Add CSRF tokens if cross-site embedding or broader cookie policies are introduced.
- Use Argon2id through a reviewed authentication service.
- Store sessions in PostgreSQL or Redis with rotation and device controls.
- Scan uploaded files and process images into approved formats.
- Use a private object-store bucket and expiring signed downloads.
- Split audit-log database permissions to prevent update/delete.
- Add secret scanning, dependency review, container scanning and SAST.
- Add account deletion, retention, backup, and legal-record policies.
- Remove Chromium `--no-sandbox` by deploying inside a correctly configured sandboxed runtime.
