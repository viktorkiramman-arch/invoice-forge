export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const apiBase = import.meta.env.VITE_API_URL ?? "";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const response = await fetch(`${apiBase}/api/v1${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(hasBody && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      fieldErrors?: Record<string, string[]>;
    };
    throw new ApiError(
      payload.message ?? "Request failed.",
      response.status,
      payload.code ?? "REQUEST_FAILED",
      payload.fieldErrors,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function pdfUrl(invoiceId: string, inline = false): string {
  return `${apiBase}/api/v1/invoices/${invoiceId}/pdf${inline ? "?inline=true" : ""}`;
}
