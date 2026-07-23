import type { FastifyPluginAsync } from "fastify";
import { businessUpdateSchema } from "@invoice-forge/contracts";
import { prisma } from "../../lib/prisma.js";

function validateTimezone(value: string): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
  } catch {
    throw Object.assign(new Error("Timezone must be a valid IANA timezone."), {
      statusCode: 422,
      code: "INVALID_TIMEZONE",
    });
  }
}

function validateLogoDataUrl(value: string | null | undefined): void {
  if (!value) return;
  if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    throw Object.assign(new Error("Logo must be a PNG, JPEG, or WebP image."), {
      statusCode: 422,
      code: "INVALID_LOGO",
    });
  }
}

export const businessRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    return prisma.business.findFirstOrThrow({ where: { id: request.auth!.businessId, deletedAt: null } });
  });

  app.patch("/", async (request, reply) => {
    const input = businessUpdateSchema.parse(request.body);
    validateLogoDataUrl(input.logoDataUrl);
    validateTimezone(input.timezone);

    const result = await prisma.business.updateMany({
      where: { id: request.auth!.businessId, version: input.version, deletedAt: null },
      data: {
        name: input.name,
        legalName: input.legalName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        taxIdentifier: input.taxIdentifier ?? null,
        defaultCurrency: input.defaultCurrency,
        timezone: input.timezone,
        invoicePrefix: input.invoicePrefix,
        defaultPaymentTerms: input.defaultPaymentTerms ?? null,
        defaultTaxMode: input.defaultTaxMode,
        logoDataUrl: input.logoDataUrl ?? null,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      return reply.code(409).send({
        code: "VERSION_CONFLICT",
        message: "Business settings changed in another session.",
        requestId: request.id,
      });
    }

    return prisma.business.findUniqueOrThrow({ where: { id: request.auth!.businessId } });
  });
};
