import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labSsrfVulnerableImport } from "@/lib/api/lab-ssrf.server";
import { labImportSchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API7:2023 (SSRF).
 * Fetches whatever URL the caller supplies (against a simulated network).
 */
export const Route = createFileRoute("/api/v1/lab/ssrf/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");
        const parsed = labImportSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          return jsonError("bad_request", "Provide a URL.", parsed.error.flatten());
        }
        return jsonOk({ owaspMapping: "API7:2023", ...labSsrfVulnerableImport(parsed.data.url) });
      },
    },
  },
});
