import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, readJsonBody } from "@/lib/api/http";
import { VULNERABLE_HEADERS, labMisconfigVulnerable } from "@/lib/api/lab-misconfig.server";
import { labProbeSchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY MISCONFIGURED LAB ENDPOINT — API8:2023.
 * Debug mode on: leaks configuration, synthetic secrets and stack traces,
 * returns wildcard CORS with credentials and omits hardening headers.
 */
export const Route = createFileRoute("/api/v1/lab/misconfig/diagnostics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");
        const parsed = labProbeSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) return jsonError("bad_request", "Provide a valid probe.");
        const result = labMisconfigVulnerable(parsed.data.probe, {
          userId: caller.userId,
          email: caller.email,
          roles: caller.roles,
        });
        return new Response(JSON.stringify({ data: { owaspMapping: "API8:2023", ...result } }), {
          status: 200,
          headers: VULNERABLE_HEADERS,
        });
      },
    },
  },
});
