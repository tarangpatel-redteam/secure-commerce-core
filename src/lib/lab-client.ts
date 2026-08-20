import { supabase } from "@/integrations/supabase/client";

export type RawResult = {
  method: string;
  endpoint: string;
  requestBody: unknown;
  status: number;
  body: unknown;
  headers: Record<string, string>;
  durationMs: number;
};

/** Raw fetch so lab pages can display real HTTP status, headers and bodies. */
export async function labRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<RawResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const started = performance.now();
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    method,
    endpoint: `/api/v1${path}`,
    requestBody: body ?? null,
    status: response.status,
    body: text ? (JSON.parse(text) as unknown) : null,
    headers,
    durationMs: Math.round(performance.now() - started),
  };
}
