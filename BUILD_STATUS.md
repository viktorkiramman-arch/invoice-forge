# Build status

Invoice Forge is configured as a runnable local production-style application.

## Verified workflows

- Dependency installation with the committed lockfile
- Prisma Client generation, committed migration deployment, and deterministic seeding
- ESLint and Prettier checks
- Strict TypeScript checks for all workspaces
- Domain and API unit tests
- API and frontend production builds
- Playwright full-lifecycle browser test
- Draft preview and finalized PDF generation with Chromium
- Desktop and narrow-mobile responsive review
- Production dependency audit: 0 known vulnerabilities

The Compose and Dockerfile sources are formatted and internally consistent. A container build was not executed in the final verification environment because Docker was not installed.

See [README.md](README.md) for the exact setup and verification commands.
