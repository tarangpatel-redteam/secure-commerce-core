/**
 * Thin browser client for the ACME Commerce REST API.
 * It attaches the current session's bearer token so the server can identify
 * and authorize the caller; it never sends role information from the client.
 */
import { supabase } from "@/integrations/supabase/client";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { accept: "application/json" };

  if (auth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers["authorization"] = `Bearer ${token}`;
  }
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { code: string; message: string } }
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.code ?? "server_error",
      payload?.error?.message ?? "Something went wrong.",
      response.status,
    );
  }
  return payload?.data as T;
}

export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
