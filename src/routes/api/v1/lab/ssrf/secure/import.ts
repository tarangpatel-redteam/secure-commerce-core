import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labSsrfSecureImport } from "@/lib/api/lab-ssrf.server";
import { labImportSchema } from "@/lib/api/validation";

/** Secure counterpart: HTTPS-only, private-range denial, host allowlist. */
export const Route = createFileRoute("/api/v1/lab/ssrf/secure/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");
        const parsed = labImportSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          return jsonError("bad_request", "Provide a URL.", parsed.error.flatten());
        }
        const result = labSsrfSecureImport(parsed.data.url);
        if (!result.ok) {
          return new Response(
            JSON.stringify({
              error: {
                code: "forbidden",
                message: `Blocked by SSRF control: ${result.blockedBy}`,
                details: result,
              },
            }),
            { status: 403, headers: { "content-type": "application/json; charset=utf-8" } },
          );
        }
        return jsonOk({ owaspMapping: "API7:2023", ...result });
      },
    },
  },
});
