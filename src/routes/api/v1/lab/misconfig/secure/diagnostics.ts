import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, readJsonBody } from "@/lib/api/http";
import { SECURE_HEADERS, labMisconfigSecure } from "@/lib/api/lab-misconfig.server";
import { labProbeSchema } from "@/lib/api/validation";

/** Secure counterpart: hardened headers, generic error, no internals. */
export const Route = createFileRoute("/api/v1/lab/misconfig/secure/diagnostics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");
        const parsed = labProbeSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) return jsonError("bad_request", "Provide a valid probe.");
        const result = labMisconfigSecure(parsed.data.probe);
        return new Response(JSON.stringify({ data: { owaspMapping: "API8:2023", ...result } }), {
          status: 200,
          headers: SECURE_HEADERS,
        });
      },
    },
  },
});
