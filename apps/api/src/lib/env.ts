import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const explicitEnvFile = process.env.INVOICE_FORGE_ENV_FILE;
const envFileCandidates = [explicitEnvFile, path.join(projectRoot, ".env"), path.join(process.cwd(), ".env")].filter(
  (candidate): candidate is string => Boolean(candidate),
);
const envFile = envFileCandidates.find(existsSync);

if (envFile) {
  process.loadEnvFile(envFile);
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: integer("API_PORT", 3001),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "invoice_session",
  sessionTtlDays: integer("SESSION_TTL_DAYS", 7),
  chromiumPath: process.env.CHROMIUM_PATH || null,
  pdfStorageDir: path.resolve(projectRoot, process.env.PDF_STORAGE_DIR ?? "./data/pdfs"),
};
