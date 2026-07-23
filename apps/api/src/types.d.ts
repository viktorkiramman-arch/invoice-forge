import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string;
      businessId: string;
      role: string;
    } | null;
  }
}
