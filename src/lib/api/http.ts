/**
 * Shared HTTP helpers for the ACME Commerce REST API (/api/v1).
 */

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "server_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  server_error: 500,
};

const BASE_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  // Authenticated API responses must never be stored by shared caches.
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function jsonOk<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ data }), { status, headers: BASE_HEADERS });
}

export function jsonError(code: ApiErrorCode, message: string, details?: unknown): Response {
  return new Response(JSON.stringify({ error: { code, message, details } }), {
    status: STATUS_BY_CODE[code],
    headers: BASE_HEADERS,
  });
}

/** Parses a JSON body defensively; never throws. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
